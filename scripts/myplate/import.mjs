#!/usr/bin/env node
/**
 * Ticket #67: one-off import of starter Recipes from USDA MyPlate Kitchen.
 *
 *   node scripts/myplate/import.mjs --household 1            collect, match, write the output files
 *   node scripts/myplate/import.mjs --household 1 --limit 80 stop after 80 recipe pages
 *
 * Reads only. It never touches a database: it writes, to scripts/myplate/out/ (gitignored):
 *   recipes.json   the matched Recipes with grams and nutrition
 *   import.sql     run once in the Supabase SQL editor (after migration 036) to add them
 *   review.json    ingredient lines that could not be matched or converted, per Recipe
 *   skipped.json   Recipes left out (any unmatched ingredient, or no ingredients/servings)
 *
 * Politeness: reads robots.txt first and stops if the recipe pages are disallowed; at most one
 * request to the site every 2 seconds; every page is cached in scripts/myplate/.cache/ (gitignored)
 * so a re-run fetches nothing twice.
 *
 * Environment (never printed):
 *   FDC_API_KEY   FoodData Central key. Without one, DEMO_KEY is used; if it rate-limits (429)
 *                 the run stops and prints the command to re-run with your own key.
 *
 * A Recipe is imported only when every ingredient line is matched to a USDA Foundation or
 * SR Legacy food and converted to grams, apart from lines with no amount that are plainly
 * negligible (salt, pepper, water, cooking spray), which are listed in review.json as skipped.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMacros } from '../backfill-usda-macros.mjs';
import {
  buildSql,
  extractRecipeLd,
  extractRecipeUrls,
  isAllowed,
  kcalPer100g,
  parseIngredient,
  parseRobots,
  parseYield,
  pickMatch,
  recipeTotals,
  toGrams,
} from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, '.cache');
const OUT = join(HERE, 'out');
const SITE = 'https://www.myplate.gov';
const LISTING = `${SITE}/myplate-kitchen/recipes`;
const FDC = 'https://api.nal.usda.gov/fdc/v1';
const UA = 'CalorieManagerImport/1.0 (personal household project; one-off, 2 s between requests)';
const SITE_GAP_MS = 2000;
const NEGLIGIBLE = /^(salt|pepper|black pepper|water|cooking spray|nonstick cooking spray|ice)\b/i;

class StopError extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastSite = 0;

function cachePath(url) {
  return join(CACHE, `${createHash('sha1').update(url).digest('hex')}.txt`);
}

async function cachedGet(url, { site, headers = {} }) {
  const file = cachePath(url.replace(/([?&])api_key=[^&]*&?/, '$1'));
  if (existsSync(file)) return readFileSync(file, 'utf8');
  if (site) {
    const wait = lastSite + SITE_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastSite = Date.now();
  } else {
    await sleep(1100); // keep well under the FoodData Central hourly limit
  }
  const res = await fetch(url, { headers: { 'user-agent': UA, ...headers } });
  if (res.status === 429) throw new StopError('FoodData Central rate limit (429).');
  if (!res.ok) throw new Error(`${res.status} for ${url.replace(/api_key=[^&]*/, 'api_key=…')}`);
  const text = await res.text();
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, text);
  return text;
}

function parseArgs(argv) {
  const o = { household: null, limit: 80 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--household') o.household = Number(argv[++i]);
    else if (argv[i] === '--limit') o.limit = Number(argv[++i]);
    else throw new Error(`Unknown option: ${argv[i]}`);
  }
  if (!Number.isInteger(o.household) || o.household < 1) {
    throw new Error('--household <id> is required (your Household id, for import.sql)');
  }
  return o;
}

const fdcKey = process.env.FDC_API_KEY || 'DEMO_KEY';
const fdcCache = new Map();

async function fdcSearch(name) {
  const params = new URLSearchParams({ query: name, dataType: 'Foundation,SR Legacy', pageSize: '10', api_key: fdcKey });
  const text = await cachedGet(`${FDC}/foods/search?${params}`, { site: false });
  return JSON.parse(text).foods ?? [];
}

async function fdcFood(fdcId) {
  if (fdcCache.has(fdcId)) return fdcCache.get(fdcId);
  const text = await cachedGet(`${FDC}/food/${fdcId}?api_key=${encodeURIComponent(fdcKey)}`, { site: false });
  const food = JSON.parse(text);
  fdcCache.set(fdcId, food);
  return food;
}

function portionsOf(food) {
  return (food.foodPortions ?? []).map((p) => ({
    gramWeight: p.gramWeight,
    amount: p.amount,
    measure: [p.measureUnit?.name, p.modifier, p.portionDescription].filter((x) => x && x !== 'undetermined').join(' '),
  }));
}

async function matchLine(line) {
  const parsed = parseIngredient(line);
  if (parsed.qty == null && NEGLIGIBLE.test(parsed.name)) return { skipped: 'negligible', parsed };
  if (!parsed.name) return { reason: 'no ingredient name', parsed };
  const hit = pickMatch(parsed.name, await fdcSearch(parsed.name));
  if (!hit) return { reason: 'no confident USDA match', parsed };
  const food = await fdcFood(hit.fdcId);
  const g = toGrams(parsed, portionsOf(food));
  if (g.grams == null) return { reason: g.reason, parsed, candidate: hit.description };
  const macros = parseMacros(food);
  return {
    parsed,
    grams: g.grams,
    food: { fdcId: String(food.fdcId), name: food.description, kcal: kcalPer100g(food), ...macros },
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  mkdirSync(OUT, { recursive: true });

  const robotsText = await cachedGet(`${SITE}/robots.txt`, { site: true });
  const rules = parseRobots(robotsText);
  if (!isAllowed(rules, '/myplate-kitchen/recipes')) {
    throw new StopError('robots.txt disallows the MyPlate Kitchen recipe pages. Stopping.');
  }
  const urls = new Set();
  for (const src of [`${SITE}/sitemap.xml`, LISTING]) {
    try {
      for (const u of extractRecipeUrls(await cachedGet(src, { site: true }), SITE)) {
        if (isAllowed(rules, new URL(u).pathname)) urls.add(u);
      }
    } catch (e) {
      console.warn(`Could not read ${src}: ${e.message}`);
    }
  }
  console.log(`Found ${urls.size} recipe URLs.`);

  const imported = [];
  const review = [];
  const skipped = [];
  let pages = 0;
  for (const url of [...urls].slice(0, opts.limit)) {
    pages += 1;
    const ld = extractRecipeLd(await cachedGet(url, { site: true }));
    const lines = ld?.recipeIngredient ?? [];
    const servings = parseYield(ld?.recipeYield);
    if (!ld || !lines.length || !servings) {
      skipped.push({ url, reason: 'no Recipe data, ingredients or servings on the page' });
      continue;
    }
    const items = [];
    const problems = [];
    for (const line of lines) {
      const r = await matchLine(String(line));
      if (r.skipped) problems.push({ line, skipped: r.skipped });
      else if (r.reason) problems.push({ line, reason: r.reason, candidate: r.candidate ?? null });
      else items.push({ text: r.parsed.text, grams: r.grams, food: r.food });
    }
    if (problems.length) review.push({ url, name: ld.name, problems });
    if (problems.some((p) => p.reason)) {
      skipped.push({ url, name: ld.name, reason: 'has unmatched ingredient lines (see review.json)' });
      continue;
    }
    imported.push({
      url,
      name: String(ld.name).slice(0, 120),
      servings,
      ingredients: items,
      nutrition: recipeTotals(items, servings),
    });
  }

  writeFileSync(join(OUT, 'recipes.json'), JSON.stringify(imported, null, 2));
  writeFileSync(join(OUT, 'review.json'), JSON.stringify(review, null, 2));
  writeFileSync(join(OUT, 'skipped.json'), JSON.stringify(skipped, null, 2));
  writeFileSync(join(OUT, 'import.sql'), buildSql(imported, opts.household));
  const lineCount = review.reduce((n, r) => n + r.problems.filter((p) => p.reason).length, 0);
  console.log(
    `Pages read: ${pages}. Recipes ready: ${imported.length}. Skipped: ${skipped.length}. Unmatched lines: ${lineCount}.`,
  );
  if (imported.length < 50) console.log('Fewer than 50 Recipes matched; see review.json and skipped.json.');
}

main().catch((e) => {
  if (e instanceof StopError) {
    console.error(`STOPPED: ${e.message}`);
    if (/429/.test(e.message)) {
      console.error('Re-run with your own key (cached pages are not fetched again):');
      console.error('  FDC_API_KEY=<your key> node scripts/myplate/import.mjs --household <id>');
    }
  } else {
    console.error(e.message);
  }
  process.exit(1);
});
