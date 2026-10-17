// Ticket #13: tests for the macro backfill. Run with: node --test scripts/
// Uses the hand-written fixture in scripts/fixtures; never calls FoodData Central.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseMacros,
  buildPatch,
  parseArgs,
  createRateLimiter,
  fetchFdcFood,
  FdcError,
  MAX_REQUESTS_PER_HOUR,
} from './backfill-usda-macros.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, 'fixtures', 'fdc-food-sample.json'), 'utf8'));
const HOUR = 60 * 60 * 1000;

test('parseMacros reads the six macros from a full food record', () => {
  assert.deepEqual(parseMacros(fixture.food), {
    protein_g: 31,
    carbs_g: 0,
    fat_g: 3.6,
    fibre_g: null,
    sugars_g: 0,
    sodium_mg: 74,
  });
});

test('a nutrient reported as 0 is 0, and a missing one is null, never 0', () => {
  const macros = parseMacros(fixture.food);
  assert.equal(macros.carbs_g, 0);
  assert.equal(macros.sugars_g, 0);
  assert.equal(macros.fibre_g, null, 'fibre is absent from the record, so NULL');
});

test('parseMacros reads the search-hit shape too', () => {
  assert.deepEqual(parseMacros(fixture.searchHit), {
    protein_g: 10.2,
    carbs_g: 3.6,
    fat_g: 0.4,
    fibre_g: null,
    sugars_g: 3.2,
    sodium_mg: 36,
  });
});

test('parseMacros gives NULL for a nutrient in the wrong unit, with no amount, or with no food', () => {
  const food = {
    foodNutrients: [
      { nutrient: { id: 1093, number: '307', unitName: 'G' }, amount: 0.5 }, // sodium in g: not trusted
      { nutrient: { id: 1003, number: '203', unitName: 'g' }, amount: null }, // no amount
    ],
  };
  const macros = parseMacros(food);
  assert.equal(macros.sodium_mg, null);
  assert.equal(macros.protein_g, null);
  assert.deepEqual(parseMacros(null), {
    protein_g: null, carbs_g: null, fat_g: null, fibre_g: null, sugars_g: null, sodium_mg: null,
  });
});

test('parseMacros prefers a match by id over a match by number', () => {
  const food = {
    foodNutrients: [
      { nutrient: { id: 1063, number: '269', unitName: 'g' }, amount: 7 },
      { nutrient: { id: 2000, number: '269', unitName: 'g' }, amount: 2 },
    ],
  };
  assert.equal(parseMacros(food).sugars_g, 2);
});

test('buildPatch writes only the macros USDA gave, plus the check time', () => {
  const macros = parseMacros(fixture.food);
  const patch = buildPatch(macros, '2026-10-17T00:00:00.000Z');
  assert.deepEqual(patch, {
    macros_checked_at: '2026-10-17T00:00:00.000Z',
    protein_g: 31,
    carbs_g: 0,
    fat_g: 3.6,
    sugars_g: 0,
    sodium_mg: 74,
  });
  assert.equal('fibre_g' in patch, false, 'a missing fibre is not written, so it stays NULL');
  assert.equal('kcal_per_100g' in patch, false);
});

test('parseArgs is a dry run by default', () => {
  assert.deepEqual(parseArgs([]), { apply: false, limit: Infinity });
  assert.equal(parseArgs(['--apply']).apply, true);
  assert.equal(parseArgs(['--apply', '--dry-run']).apply, false);
  assert.equal(parseArgs(['--limit', '5']).limit, 5);
  assert.throws(() => parseArgs(['--limit', '0']));
  assert.throws(() => parseArgs(['--write']));
});

// A fake clock: sleeping advances time instantly, so tests never really wait.
function fakeClock() {
  let t = 0;
  return {
    now: () => t,
    sleep: async (ms) => { t += ms; },
  };
}

test('the rate limiter spaces requests and never allows more than 900 in an hour', async () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ now: clock.now, sleep: clock.sleep });
  const starts = [];
  for (let i = 0; i < 1000; i += 1) {
    await limiter.take();
    starts.push(clock.now());
  }
  assert.equal(MAX_REQUESTS_PER_HOUR, 900);
  for (let i = 1; i < starts.length; i += 1) {
    assert.ok(starts[i] - starts[i - 1] >= 4000, `request ${i} is spaced at least 4 s after the last`);
  }
  for (let i = 0; i + MAX_REQUESTS_PER_HOUR < starts.length; i += 1) {
    assert.ok(
      starts[i + MAX_REQUESTS_PER_HOUR] - starts[i] >= HOUR,
      `request ${i + MAX_REQUESTS_PER_HOUR} starts less than an hour after request ${i}`,
    );
  }
});

test('the 901st request waits until the first request is an hour old', async () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ now: clock.now, sleep: clock.sleep });
  for (let i = 0; i < MAX_REQUESTS_PER_HOUR; i += 1) await limiter.take();
  const before = clock.now();
  await limiter.take();
  assert.equal(clock.now(), HOUR, 'the 901st starts exactly one hour after the first');
  assert.ok(clock.now() > before);
});

test('fetchFdcFood calls the food endpoint once and stops at a 429 without retrying', async () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ now: clock.now, sleep: clock.sleep });
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return { status: 429, ok: false, json: async () => ({}) };
  };
  await assert.rejects(
    fetchFdcFood({ fdcId: 999001, apiKey: 'SECRET-TEST-KEY', limiter, fetchImpl }),
    (err) => err instanceof FdcError && err.status === 429,
  );
  assert.equal(calls.length, 1, 'no retry on 429');
  assert.match(calls[0], /\/food\/999001\?api_key=SECRET-TEST-KEY$/);
});

test('fetchFdcFood returns the parsed JSON on success and never puts the key in an error', async () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ now: clock.now, sleep: clock.sleep });
  const ok = await fetchFdcFood({
    fdcId: 999001,
    apiKey: 'K',
    limiter,
    fetchImpl: async () => ({ status: 200, ok: true, json: async () => fixture.food }),
  });
  assert.equal(ok.fdcId, 999001);

  await assert.rejects(
    fetchFdcFood({
      fdcId: 999001,
      apiKey: 'TOPSECRET',
      limiter,
      fetchImpl: async () => ({ status: 500, ok: false, json: async () => ({}) }),
    }),
    (err) => err.status === 500 && !String(err.message).includes('TOPSECRET'),
  );
});

test('fetchFdcFood refuses an id that is not digits', async () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ now: clock.now, sleep: clock.sleep });
  await assert.rejects(
    fetchFdcFood({ fdcId: '12/../x', apiKey: 'K', limiter, fetchImpl: async () => { throw new Error('should not run'); } }),
    FdcError,
  );
});
