// Looks a scanned barcode up in Open Food Facts when USDA has no match (ticket #19).
//
//   POST { code }   answers { status: 'found', product, barcode, offCode }
//                   or { status: 'notFound' } | { status: 'rateLimited' }
//                   | { status: 'invalid' } | { status: 'unavailable', reason }
//
// The caller must be signed in (any Member). The product is stored unmodified in
// off_products (migration 026) and read from there on the next scan, so a stored product
// uses no read. Reads of Open Food Facts are limited to 15 a minute (see _shared/off.ts).
//
// Secrets (optional; `supabase secrets set`): OFF_USER_AGENT sets the User-Agent sent to
// Open Food Facts. SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are
// provided by Supabase.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import {
  DEFAULT_USER_AGENT,
  lookupOffProduct,
  normalizeOffCode,
  OFF_WINDOW_MS,
  type OffDeps,
  type OffOutcome,
} from '../_shared/off.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'The body must be JSON' }, 400);
  }
  if (normalizeOffCode(body.code) === null) return json({ status: 'invalid' });

  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  const deps: OffDeps = {
    now: () => Date.now(),
    recentReads: async () => {
      const since = new Date(Date.now() - OFF_WINDOW_MS).toISOString();
      const { data, error } = await service
        .from('off_read_log')
        .select('read_at')
        .gte('read_at', since);
      if (error) throw error;
      return (data ?? []).map((row: { read_at: string }) => new Date(row.read_at).getTime());
    },
    recordRead: async (at: number) => {
      const { error } = await service
        .from('off_read_log')
        .insert({ read_at: new Date(at).toISOString() });
      if (error) throw error;
    },
    storedProduct: async (barcode: string) => {
      const { data, error } = await service
        .from('off_products')
        .select('off_code, product')
        .eq('barcode', barcode)
        .maybeSingle();
      if (error) throw error;
      return data ? { offCode: data.off_code, product: data.product } : null;
    },
    saveProduct: async (barcode, offCode, product) => {
      const { error } = await service
        .from('off_products')
        .upsert({ barcode, off_code: offCode, product, fetched_at: new Date().toISOString() });
      if (error) throw error;
    },
    fetchImpl: (target, init, signal) => fetch(target, { ...init, signal }),
    userAgent: Deno.env.get('OFF_USER_AGENT') || DEFAULT_USER_AGENT,
  };

  try {
    const outcome: OffOutcome = await lookupOffProduct(body.code, deps);
    if (outcome.status === 'found') {
      return json({
        status: 'found',
        barcode: outcome.barcode,
        offCode: outcome.offCode,
        product: outcome.product,
      });
    }
    if (outcome.status === 'unavailable') {
      console.error('off-lookup unavailable', outcome.reason);
      return json({ status: 'unavailable', reason: outcome.reason });
    }
    return json({ status: outcome.status });
  } catch (error) {
    console.error('off-lookup failed', error instanceof Error ? error.message : error);
    return json({ status: 'unavailable', reason: 'The lookup could not be completed' });
  }
});
