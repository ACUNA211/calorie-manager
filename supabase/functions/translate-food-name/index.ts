// Fills the Spanish name of Food Library foods (ticket #16, ADR 0002, ADR 0003).
//
//   POST { food_id }                     translate one food (the app calls this after a save)
//   POST { backfill: true, limit? }      translate up to `limit` foods (1 to 25, default 10)
//                                        of the caller's Household that have no Spanish name
//                                        and were never tried; returns how many are left
//
// The caller's JWT decides which foods are visible (row-level security), so a Member can
// only translate their own Household's foods. The service role then makes the paid call
// through the AI gate (ai-gate.ts) and writes the name with apply_food_spanish_name, which
// never overwrites a Member's own Spanish name.
//
// Secrets (set with `supabase secrets set`, never in a file):
//   GOOGLE_TRANSLATE_KEY                              Cloud Translation Basic (first choice)
//   AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION     Azure AI Translator F0 (fallback, optional)
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// Without a translation key the function answers "failed" and the food keeps no Spanish name.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { createAiGate } from '../_shared/ai-gate.ts';
import {
  translateFoodName,
  type TranslationOutcome,
  type TranslatorKeys,
} from '../_shared/translate.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FOOD_FIELDS = 'id, name, household_id, name_es, name_es_edited_by_member';
const DEFAULT_BACKFILL_LIMIT = 10;
const MAX_BACKFILL_LIMIT = 25;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// deno-lint-ignore no-explicit-any
type Client = any;

interface Context {
  service: Client;
  keys: TranslatorKeys;
  memberIds: Map<number, number | null>;
  userId: string;
}

// The caller's Member id in one Household (null when none), cached for this request.
async function memberIdFor(ctx: Context, householdId: number): Promise<number | null> {
  if (ctx.memberIds.has(householdId)) return ctx.memberIds.get(householdId) ?? null;
  const { data, error } = await ctx.service
    .from('members')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('household_id', householdId)
    .maybeSingle();
  if (error) throw error;
  const id = data ? Number(data.id) : null;
  ctx.memberIds.set(householdId, id);
  return id;
}

// Translates one food and stores the result. A call refused by the cap stores nothing, so
// the food can be tried again later. Any other failure records the attempt and keeps the
// Spanish name empty.
async function translateRow(
  ctx: Context,
  row: { id: number; name: string; household_id: number }
): Promise<TranslationOutcome> {
  const gate = createAiGate({
    client: ctx.service,
    householdId: Number(row.household_id),
    memberId: await memberIdFor(ctx, Number(row.household_id)),
  });
  const outcome = await translateFoodName({
    text: row.name,
    keys: ctx.keys,
    gate,
    fetchImpl: (url, init) => fetch(url, init),
  });
  if (outcome.status === 'limit_reached') return outcome;
  const { error } = await ctx.service.rpc('apply_food_spanish_name', {
    p_food_id: Number(row.id),
    p_name: outcome.status === 'translated' ? outcome.text : null,
  });
  if (error) throw error;
  return outcome;
}

async function translateOne(ctx: Context, userClient: Client, foodId: number): Promise<Response> {
  const { data: food, error } = await userClient
    .from('foods')
    .select(FOOD_FIELDS)
    .eq('id', foodId)
    .maybeSingle();
  if (error) return json({ error: 'Could not read the food' }, 500);
  if (!food) return json({ error: 'Food not found' }, 404);
  // A Spanish name already there, or a Member's own, is kept as it is
  if (food.name_es !== null || food.name_es_edited_by_member) {
    return json({ status: 'kept', name_es: food.name_es });
  }
  const outcome = await translateRow(ctx, food);
  if (outcome.status === 'limit_reached') {
    return json({
      status: 'limit_reached',
      message: 'AI limit reached this month',
    });
  }
  if (outcome.status === 'failed') {
    return json({ status: 'failed', reason: outcome.reason, name_es: null });
  }
  return json({
    status: 'translated',
    name_es: outcome.text,
    provider: outcome.provider,
  });
}

async function backfill(ctx: Context, userClient: Client, rawLimit: unknown): Promise<Response> {
  const requested = Number(rawLimit);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(Math.floor(requested), 1), MAX_BACKFILL_LIMIT)
    : DEFAULT_BACKFILL_LIMIT;

  // Foods with no Spanish name, not named by a Member, and not tried before
  const pending = (columns: string, options?: { count: 'exact'; head: true }) =>
    userClient
      .from('foods')
      .select(columns, options)
      .is('name_es', null)
      .eq('name_es_edited_by_member', false)
      .is('name_es_attempted_at', null);

  const { data: rows, error } = await pending('id, name, household_id')
    .order('id', { ascending: true })
    .limit(limit);
  if (error) return json({ error: 'Could not read the foods' }, 500);

  const tally = {
    processed: 0,
    translated: 0,
    failed: 0,
    limit_reached: false,
  };
  for (const row of rows ?? []) {
    const outcome = await translateRow(ctx, row);
    if (outcome.status === 'limit_reached') {
      tally.limit_reached = true;
      break;
    }
    tally.processed += 1;
    if (outcome.status === 'translated') tally.translated += 1;
    else tally.failed += 1;
  }

  const { count, error: countError } = await pending('id', {
    count: 'exact',
    head: true,
  });
  if (countError) return json({ error: 'Could not count the remaining foods' }, 500);
  return json({ ...tally, remaining: count ?? null });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Sign in first' }, 401);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return json({ error: 'Sign in first' }, 401);

  let body: { food_id?: unknown; backfill?: unknown; limit?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'The body must be JSON' }, 400);
  }

  const ctx: Context = {
    service: createClient(url, serviceKey, { auth: { persistSession: false } }),
    keys: {
      googleKey: Deno.env.get('GOOGLE_TRANSLATE_KEY') || undefined,
      azureKey: Deno.env.get('AZURE_TRANSLATOR_KEY') || undefined,
      azureRegion: Deno.env.get('AZURE_TRANSLATOR_REGION') || undefined,
    },
    memberIds: new Map(),
    userId: userData.user.id,
  };

  try {
    if (body.backfill === true) return await backfill(ctx, userClient, body.limit);
    const foodId = Number(body.food_id);
    if (!Number.isInteger(foodId) || foodId <= 0) {
      return json({ error: 'food_id is required' }, 400);
    }
    return await translateOne(ctx, userClient, foodId);
  } catch (error) {
    console.error('translate-food-name failed', error instanceof Error ? error.message : error);
    return json({ error: 'Translation could not be stored' }, 500);
  }
});
