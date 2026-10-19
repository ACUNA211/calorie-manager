/**
 * Ticket #67: pure logic for the MyPlate Kitchen import (no network, no database).
 * robots.txt rules, Recipe JSON-LD reading, ingredient-line parsing, grams conversion,
 * conservative USDA matching, nutrition totals, and the SQL output.
 */

// ---- robots.txt -----------------------------------------------------------------------

/** Rules for `agent` (falls back to "*"). Returns { allow, disallow, crawlDelay }. */
export function parseRobots(text, agent = 'calorie-manager-import') {
  const groups = [];
  let cur = null;
  let lastWasAgent = false;
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const val = line.slice(i + 1).trim();
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], allow: [], disallow: [], crawlDelay: null };
        groups.push(cur);
      }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (key === 'allow') cur.allow.push(val);
    else if (key === 'disallow') cur.disallow.push(val);
    else if (key === 'crawl-delay') cur.crawlDelay = Number(val) || null;
  }
  const a = agent.toLowerCase();
  const specific = groups.filter((g) => g.agents.some((x) => x !== '*' && a.includes(x)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  const out = { allow: [], disallow: [], crawlDelay: null };
  for (const g of chosen) {
    out.allow.push(...g.allow);
    out.disallow.push(...g.disallow);
    if (g.crawlDelay) out.crawlDelay = g.crawlDelay;
  }
  return out;
}

function ruleRegex(rule) {
  const endsAnchored = rule.endsWith('$');
  const body = endsAnchored ? rule.slice(0, -1) : rule;
  const esc = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${esc}${endsAnchored ? '$' : ''}`);
}

/** Longest matching rule wins; allow wins a tie; an empty Disallow allows everything. */
export function isAllowed(rules, path) {
  let best = { len: -1, allow: true };
  for (const [list, allow] of [
    [rules.disallow, false],
    [rules.allow, true],
  ]) {
    for (const r of list) {
      if (!r) continue;
      if (ruleRegex(r).test(path) && (r.length > best.len || (r.length === best.len && allow))) {
        best = { len: r.length, allow };
      }
    }
  }
  return best.allow;
}

// ---- Recipe pages ---------------------------------------------------------------------

function* walkLd(node) {
  if (Array.isArray(node)) {
    for (const n of node) yield* walkLd(n);
  } else if (node && typeof node === 'object') {
    yield node;
    if (node['@graph']) yield* walkLd(node['@graph']);
  }
}

/** The schema.org Recipe object from a page's JSON-LD, or null. */
export function extractRecipeLd(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(String(html ?? '')))) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    for (const node of walkLd(data)) {
      const t = node['@type'];
      if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return node;
    }
  }
  return null;
}

/** Number of servings from schema.org recipeYield ("4", ["4","4 servings"], 4). Null if unknown. */
export function parseYield(y) {
  const v = Array.isArray(y) ? y.map(String).join(' ') : String(y ?? '');
  const m = v.match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** Recipe URLs from a sitemap or listing page: same-host links ending /recipes/<slug>. */
export function extractRecipeUrls(text, base) {
  const urls = new Set();
  const re = /(?:<loc>|href=["'])([^<"'\s]+)/gi;
  let m;
  while ((m = re.exec(String(text ?? '')))) {
    try {
      const u = new URL(m[1], base);
      u.hash = '';
      u.search = '';
      if (u.host === new URL(base).host && /\/recipes\/[^/]+\/?$/.test(u.pathname)) urls.add(u.href);
    } catch {
      /* skip a bad link */
    }
  }
  return [...urls].sort();
}

// ---- Ingredient lines -----------------------------------------------------------------

const FRACTIONS = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125 };

function parseQty(s) {
  let t = s.trim();
  for (const [k, v] of Object.entries(FRACTIONS)) t = t.replace(k, ` ${v} `);
  let total = 0;
  let any = false;
  for (const part of t.split(/\s+/).filter(Boolean)) {
    if (/^\d+\/\d+$/.test(part)) {
      const [a, b] = part.split('/').map(Number);
      if (!b) return null;
      total += a / b;
    } else if (/^\d+(\.\d+)?$/.test(part)) {
      total += Number(part);
    } else {
      return null;
    }
    any = true;
  }
  return any ? total : null;
}

// Unit word -> [kind, factor]. Mass: grams. Volume: millilitres. Count: needs a USDA portion.
const UNITS = {
  g: ['mass', 1],
  gram: ['mass', 1],
  grams: ['mass', 1],
  oz: ['mass', 28.3495],
  ounce: ['mass', 28.3495],
  ounces: ['mass', 28.3495],
  lb: ['mass', 453.592],
  lbs: ['mass', 453.592],
  pound: ['mass', 453.592],
  pounds: ['mass', 453.592],
  ml: ['vol', 1],
  tsp: ['vol', 4.92892],
  teaspoon: ['vol', 4.92892],
  teaspoons: ['vol', 4.92892],
  tbsp: ['vol', 14.7868],
  tablespoon: ['vol', 14.7868],
  tablespoons: ['vol', 14.7868],
  cup: ['vol', 236.588],
  cups: ['vol', 236.588],
  clove: ['count', 1],
  cloves: ['count', 1],
  can: ['count', 1],
  cans: ['count', 1],
  slice: ['count', 1],
  slices: ['count', 1],
  pinch: ['count', 1],
  package: ['count', 1],
};

/**
 * "1 1/2 cups chopped onion, divided" -> { qty, unit, name, text }.
 * qty is null when the line has no leading number ("salt to taste"); it goes to review.
 */
export function parseIngredient(line) {
  const text = String(line ?? '').replace(/\s+/g, ' ').trim();
  let rest = text.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const m = rest.match(
    /^((?:\d+\s+)?\d+\/\d+|\d+(?:\.\d+)?(?:\s*[½⅓⅔¼¾⅛])?|[½⅓⅔¼¾⅛])\s*(?:-\s*\d+(?:\.\d+)?)?\s*(.*)$/,
  );
  let qty = null;
  if (m) {
    qty = parseQty(m[1]);
    rest = m[2];
  }
  let unit = null;
  const w = rest.match(/^([A-Za-z]+)\.?\s+(.*)$/);
  if (w && UNITS[w[1].toLowerCase()]) {
    unit = w[1].toLowerCase();
    rest = w[2].replace(/^of\s+/i, '');
  }
  const name = rest.split(',')[0].replace(/\s+/g, ' ').trim();
  return { qty, unit, name, text };
}

function round(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Grams for a parsed line, or { grams: null, reason }. Mass units convert directly. Volume and
 * count units need `portions` (USDA foodPortions: [{ gramWeight, amount, measure }]); with no
 * fitting portion nothing is guessed. Cans and packages are never converted.
 */
export function toGrams(parsed, portions = []) {
  const { qty, unit } = parsed;
  if (qty == null) return { grams: null, reason: 'no amount' };
  if (unit && UNITS[unit][0] === 'mass') return { grams: round(qty * UNITS[unit][1]) };
  const list = portions.filter((p) => p.gramWeight > 0);
  const per = (p) => (p.amount > 0 ? p.amount : 1);
  if (unit) {
    const wanted = unit.replace(/s$/, '');
    for (const p of list) {
      if (new RegExp(`\\b${wanted}s?\\b`).test(String(p.measure ?? '').toLowerCase())) {
        return { grams: round((qty * p.gramWeight) / per(p)) };
      }
    }
    if (UNITS[unit][0] === 'vol') {
      const cup = list.find((p) => /\bcup\b/.test(String(p.measure ?? '').toLowerCase()));
      if (cup) {
        return { grams: round((qty * UNITS[unit][1] * cup.gramWeight) / (236.588 * per(cup))) };
      }
    }
  } else {
    const one = list.find((p) => !/\b(cup|tbsp|tsp|oz|lb|slice|fl)\b/i.test(String(p.measure ?? '')));
    if (one) return { grams: round((qty * one.gramWeight) / per(one)) };
  }
  return { grams: null, reason: `no gram conversion for "${unit ?? 'each'}"` };
}

// ---- Matching -------------------------------------------------------------------------

const STOP = new Set([
  'fresh', 'frozen', 'chopped', 'diced', 'sliced', 'minced', 'large', 'small', 'medium',
  'finely', 'low', 'sodium', 'fat', 'free', 'reduced', 'unsalted', 'optional', 'ground',
  'and', 'or', 'of', 'the', 'a', 'to', 'taste', 'canned', 'drained', 'rinsed', 'cooked', 'raw',
]);

export function tokens(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t))
    .map((t) => (t.length > 4 ? t.replace(/ies$/, 'y').replace(/(es|s)$/, '') : t));
}

/**
 * Best candidate for an ingredient name, or null. Only Foundation / SR Legacy candidates count.
 * Every ingredient token must appear in the description (so "chicken breast" never matches
 * "chicken thigh") and the description may add at most 3 other words. Raw is preferred.
 */
export function pickMatch(name, candidates) {
  const want = tokens(name);
  if (!want.length) return null;
  let best = null;
  for (const c of candidates ?? []) {
    if (!['Foundation', 'SR Legacy'].includes(c.dataType)) continue;
    const have = tokens(c.description);
    if (!want.every((t) => have.includes(t))) continue;
    const extra = have.length - want.length;
    if (extra > 3) continue;
    const score = extra + (/\braw\b/i.test(c.description) ? 0 : 0.5);
    if (!best || score < best.score) best = { c, score };
  }
  return best ? best.c : null;
}

// ---- Nutrition and rows ---------------------------------------------------------------

/** kcal per 100 g from a FoodData Central food (1008, else Atwater 2047/2048). Null if missing. */
export function kcalPer100g(food) {
  const list = Array.isArray(food?.foodNutrients) ? food.foodNutrients : [];
  for (const id of [1008, 2047, 2048]) {
    const hit = list.find(
      (x) => (x?.nutrient?.id ?? x?.nutrientId) === id && Number.isFinite(x?.amount ?? x?.value),
    );
    if (hit) return hit.amount ?? hit.value;
  }
  return null;
}

/** Totals for matched ingredients [{ grams, food: { kcal, protein_g, ... } }]. A macro no food reports stays null. */
export function recipeTotals(items, servings) {
  const keys = ['kcal', 'protein_g', 'carbs_g', 'fat_g'];
  const total = Object.fromEntries(keys.map((k) => [k, null]));
  for (const it of items) {
    for (const k of keys) {
      const v = it.food[k];
      if (v == null) continue;
      total[k] = (total[k] ?? 0) + (v * it.grams) / 100;
    }
  }
  const perServing = Object.fromEntries(
    keys.map((k) => [k, total[k] == null || !servings ? null : round(total[k] / servings)]),
  );
  return {
    total: Object.fromEntries(keys.map((k) => [k, total[k] == null ? null : round(total[k])])),
    perServing,
  };
}

export function credit(url) {
  return `Source: USDA MyPlate Kitchen, ${url}`;
}

function q(v) {
  return v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`;
}
const num = (v) => (v == null ? 'null' : String(v));

/**
 * SQL for a batch of Recipes, for the Supabase SQL editor (one transaction). Needs migration 036
 * (source_name, source_url). Re-running skips Recipes already imported and foods already held.
 */
export function buildSql(recipes, householdId) {
  const h = Number(householdId);
  if (!Number.isInteger(h) || h < 1) throw new Error('household id must be a positive whole number');
  const out = [`-- MyPlate Kitchen import (ticket 67). Household ${h}.`, 'begin;'];
  const seen = new Set();
  for (const r of recipes) {
    for (const i of r.ingredients) {
      if (seen.has(i.food.fdcId)) continue;
      seen.add(i.food.fdcId);
      const f = i.food;
      out.push(
        `insert into public.foods (household_id, name, source, source_id, kcal_per_100g, protein_g, carbs_g, fat_g, fibre_g, sugars_g, sodium_mg, macros_checked_at) values (${h}, ${q(f.name)}, 'usda', ${q(f.fdcId)}, ${num(f.kcal)}, ${num(f.protein_g)}, ${num(f.carbs_g)}, ${num(f.fat_g)}, ${num(f.fibre_g)}, ${num(f.sugars_g)}, ${num(f.sodium_mg)}, now()) on conflict (household_id, source, source_id) where source_id is not null do nothing;`,
      );
    }
  }
  for (const r of recipes) {
    out.push('do $$ declare rid bigint; begin');
    out.push(
      `  if not exists (select 1 from public.recipes where household_id = ${h} and source_url = ${q(r.url)}) then`,
    );
    out.push(
      `    insert into public.recipes (household_id, name, servings, notes, source_name, source_url) values (${h}, ${q(r.name)}, ${num(r.servings)}, ${q(credit(r.url))}, 'USDA MyPlate Kitchen', ${q(r.url)}) returning id into rid;`,
    );
    r.ingredients.forEach((i, n) => {
      out.push(
        `    insert into public.recipe_ingredients (household_id, recipe_id, food_id, grams, amount_text, sort) values (${h}, rid, (select id from public.foods where household_id = ${h} and source = 'usda' and source_id = ${q(i.food.fdcId)}), ${num(i.grams)}, ${q(i.text)}, ${n});`,
      );
    });
    out.push('  end if;', 'end $$;');
  }
  out.push('commit;');
  return out.join('\n') + '\n';
}
