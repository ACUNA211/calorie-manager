#!/usr/bin/env node
/**
 * Ticket #13: one-off backfill of macros for USDA foods saved before migration 009.
 *
 * Reads the Food Library's USDA foods that have not been checked for macros yet,
 * re-fetches each one from FoodData Central, and writes back protein, carbs, fat,
 * fibre, sugars and sodium. A nutrient USDA does not report stays NULL (never 0).
 * kcal_per_100g is never touched. Each checked food gets macros_checked_at, so a
 * re-run skips it, including foods USDA has no macros for.
 *
 * Dry run is the default: it fetches and prints what would be written, and writes nothing.
 *
 *   node scripts/backfill-usda-macros.mjs             dry run (all foods, or --limit N)
 *   node scripts/backfill-usda-macros.mjs --apply     write the macros
 *   node scripts/backfill-usda-macros.mjs --limit 20  check at most 20 foods
 *
 * Environment (read only here; never printed):
 *   FDC_API_KEY                 FoodData Central key (api.data.gov)
 *   SUPABASE_URL                project URL, e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY   service role key, used to read foods and write macros
 *
 * Rate limit: at most 900 FoodData Central requests in any hour (the free key allows
 * 1,000). Requests are also spaced at least 4 s apart. A 429 stops the run; re-run later.
 * Node 18+ (global fetch). No dependencies.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';
export const MAX_REQUESTS_PER_HOUR = 900;
const HOUR_MS = 60 * 60 * 1000;
const PAGE_SIZE = 50;

// USDA nutrient ids (FoodData Central) and numbers (USDA legacy), with the unit USDA uses.
// Keep in step with public.usda_nutrient calls in supabase/migrations/009_food_macros.sql.
export const NUTRIENTS = [
  { column: 'protein_g', ids: [1003], numbers: ['203'], unit: 'G' },
  { column: 'carbs_g', ids: [1005], numbers: ['205'], unit: 'G' },
  { column: 'fat_g', ids: [1004], numbers: ['204'], unit: 'G' },
  { column: 'fibre_g', ids: [1079], numbers: ['291'], unit: 'G' },
  { column: 'sugars_g', ids: [2000], numbers: ['269'], unit: 'G' },
  { column: 'sodium_mg', ids: [1093], numbers: ['307'], unit: 'MG' },
];

export class FdcError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'FdcError';
    this.status = status;
  }
}

function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toInt(v) {
  const n = toNumber(v);
  return n !== null && Number.isInteger(n) ? n : null;
}

/**
 * The six macros from a FoodData Central food. Accepts the full record shape
 * (nutrient: {id, number, unitName}, amount) and the search-hit shape (nutrientId,
 * nutrientNumber, unitName, value). A match by id wins over a match by number. A
 * nutrient with no amount, or in a unit other than USDA's, is NULL.
 */
export function parseMacros(food) {
  const list = Array.isArray(food?.foodNutrients) ? food.foodNutrients : [];
  const out = {};
  for (const n of NUTRIENTS) {
    let best = null;
    for (const x of list) {
      const amount = toNumber(x?.amount ?? x?.value);
      if (amount === null) continue;
      const unit = String(x?.nutrient?.unitName ?? x?.unitName ?? n.unit).toUpperCase();
      if (unit !== n.unit) continue;
      const id = toInt(x?.nutrient?.id ?? x?.nutrientId);
      const num = String(x?.nutrient?.number ?? x?.nutrientNumber ?? '');
      const byId = id !== null && n.ids.includes(id);
      const byNumber = num !== '' && n.numbers.includes(num);
      if (!byId && !byNumber) continue;
      const rank = byId ? 0 : 1;
      if (best === null || rank < best.rank) best = { rank, amount };
    }
    out[n.column] = best === null ? null : best.amount;
  }
  return out;
}

/** The columns to write: only the macros USDA gave, plus when it was checked. */
export function buildPatch(macros, checkedAt) {
  const patch = { macros_checked_at: checkedAt };
  for (const [column, value] of Object.entries(macros)) {
    if (value !== null) patch[column] = value;
  }
  return patch;
}

export function parseArgs(argv) {
  const opts = { apply: false, limit: Infinity };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') {
      opts.apply = true;
    } else if (arg === '--dry-run') {
      opts.apply = false;
    } else if (arg === '--limit') {
      const n = Number(argv[i + 1]);
      if (!Number.isInteger(n) || n < 1) throw new Error('--limit needs a whole number of 1 or more');
      opts.limit = n;
      i += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return opts;
}

/**
 * Lets at most `maxPerHour` requests start in any one hour, and spaces them at least
 * one hour / maxPerHour apart. `now` and `sleep` can be replaced in tests.
 */
export function createRateLimiter({
  maxPerHour = MAX_REQUESTS_PER_HOUR,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms)),
} = {}) {
  const spacingMs = Math.ceil(HOUR_MS / maxPerHour);
  const starts = [];
  let last = null;
  return {
    async take() {
      for (;;) {
        const t = now();
        while (starts.length > 0 && t - starts[0] >= HOUR_MS) starts.shift();
        let wait = 0;
        if (last !== null) wait = Math.max(wait, last + spacingMs - t);
        if (starts.length >= maxPerHour) wait = Math.max(wait, starts[0] + HOUR_MS - t);
        if (wait <= 0) {
          starts.push(t);
          last = t;
          return;
        }
        await sleep(wait);
      }
    },
  };
}

/** GET /food/{fdcId}. Never includes the key in an error message. */
export async function fetchFdcFood({ fdcId, apiKey, limiter, fetchImpl = fetch, base = FDC_BASE }) {
  if (!/^\d+$/.test(String(fdcId))) throw new FdcError(`Not a FoodData Central id: ${fdcId}`, 0);
  await limiter.take();
  const url = `${base}/food/${fdcId}?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetchImpl(url, { headers: { accept: 'application/json' } });
  if (res.status === 429) {
    throw new FdcError('FoodData Central rate limit reached (429). Stopping; re-run later.', 429);
  }
  if (!res.ok) throw new FdcError(`FoodData Central returned ${res.status} for fdc ${fdcId}`, res.status);
  return res.json();
}

function serviceHeaders(serviceKey, extra = {}) {
  return { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, ...extra };
}

/** Next page of USDA foods still to check, after `afterId` (keyset paging). */
export async function fetchPage({ supabaseUrl, serviceKey, afterId, fetchImpl = fetch }) {
  const params = new URLSearchParams({
    select: 'id,source_id,name',
    source: 'eq.usda',
    macros_checked_at: 'is.null',
    or: '(protein_g.is.null,carbs_g.is.null,fat_g.is.null,fibre_g.is.null,sugars_g.is.null,sodium_mg.is.null)',
    order: 'id.asc',
    limit: String(PAGE_SIZE),
  });
  if (afterId !== null) params.set('id', `gt.${afterId}`);
  const res = await fetchImpl(`${supabaseUrl}/rest/v1/foods?${params}`, {
    headers: serviceHeaders(serviceKey, { accept: 'application/json' }),
  });
  if (!res.ok) throw new Error(`Reading foods failed with status ${res.status}`);
  return res.json();
}

export async function writeMacros({ supabaseUrl, serviceKey, id, patch, fetchImpl = fetch }) {
  const res = await fetchImpl(`${supabaseUrl}/rest/v1/foods?id=eq.${id}`, {
    method: 'PATCH',
    headers: serviceHeaders(serviceKey, { 'content-type': 'application/json', prefer: 'return=minimal' }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Writing food ${id} failed with status ${res.status}`);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Set ${name} in the environment first`);
  return v;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const apiKey = requireEnv('FDC_API_KEY');
  const supabaseUrl = requireEnv('SUPABASE_URL').replace(/\/+$/, '');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const limiter = createRateLimiter();
  const stats = { checked: 0, withMacros: 0, noMacros: 0, failed: 0, written: 0 };

  console.log(opts.apply
    ? 'APPLY: macros will be written to the Food Library.'
    : 'DRY RUN: nothing will be written. Pass --apply to write.');

  let afterId = null;
  let stopped = false;
  while (!stopped && stats.checked < opts.limit) {
    const rows = await fetchPage({ supabaseUrl, serviceKey, afterId });
    if (rows.length === 0) break;
    for (const row of rows) {
      if (stats.checked >= opts.limit) break;
      afterId = row.id;
      stats.checked += 1;
      let food;
      try {
        food = await fetchFdcFood({ fdcId: row.source_id, apiKey, limiter });
      } catch (err) {
        if (err instanceof FdcError && err.status === 429) {
          console.error(err.message);
          stopped = true;
          break;
        }
        stats.failed += 1;
        console.error(`food ${row.id}: ${err.message}`);
        continue;
      }
      const macros = parseMacros(food);
      const found = Object.values(macros).filter((v) => v !== null).length;
      if (found > 0) stats.withMacros += 1;
      else stats.noMacros += 1;
      const patch = buildPatch(macros, new Date().toISOString());
      console.log(`${opts.apply ? 'write' : 'would write'} food ${row.id} (fdc ${row.source_id}, ${found}/6): ${JSON.stringify(patch)}`);
      if (opts.apply) {
        try {
          await writeMacros({ supabaseUrl, serviceKey, id: row.id, patch });
          stats.written += 1;
        } catch (err) {
          stats.failed += 1;
          console.error(err.message);
        }
      }
    }
    if (rows.length < PAGE_SIZE) break;
  }

  console.log(`Checked ${stats.checked}: ${stats.withMacros} with macros, ${stats.noMacros} with none, ${stats.failed} failed, ${stats.written} written.`);
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
