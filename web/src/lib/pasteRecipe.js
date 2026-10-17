// Paste a Recipe (ticket #30): the app side. The Member's pasted text is parsed by one AI
// call (the parse-recipe Edge Function, which goes through the AI cap); each ingredient line
// is then matched to a food with searchFoods (Food Library first, then USDA) and converted to
// grams here. Nutrition only ever comes from the matched food rows, never from the AI.
//
// Pure helpers sit beside the two async steps. The Supabase client is always the first
// argument, so tests pass a fake, and the search is injectable.

import { norm } from './norm.js';
import { saveUsdaFood, searchFoods } from './foods.js';
import { emptyRecipeDraft, nextKey } from './recipes.js';

export const PASTE_MAX_CHARS = 8000;
export const PASTE_MAX_INGREDIENTS = 60;
export const CANDIDATE_LIMIT = 8;

// The unit codes the parse returns (same list as _shared/parse-recipe.ts; a test keeps them equal).
export const RECIPE_UNITS = ['g', 'kg', 'ml', 'tsp', 'tbsp', 'cup', 'oz', 'lb', 'each'];

// Mass units convert exactly.
const MASS_GRAMS = { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 };
// Volume units assume the density of water (1 ml = 1 g). Oil, flour and sugar differ, so
// these conversions are marked approximate and the Member is asked to check them.
const VOLUME_ML = { ml: 1, tsp: 4.92892, tbsp: 14.78676, cup: 236.5882365 };

// Columns read for the Recipe editor, the same shape recipes.js uses for an ingredient's food.
const RAW_FOOD_COLUMNS =
  'id, name, brand, kcal_per_100g, protein_g, carbs_g, fat_g, fibre_g, sugars_g, sodium_mg';

// Grams for one ingredient line. Returns { grams, approximate, reason }: grams is a number
// rounded to one decimal, or null with a reason the Member must fix ('amount', 'unit' or
// 'serving' when a count has no per-item weight in the Food Library).
export function gramsFor(line, food) {
  const amount = line?.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return { grams: null, approximate: false, reason: 'amount' };
  }
  const unit = line?.unit ?? null;
  if (!unit) return { grams: null, approximate: false, reason: 'unit' };

  let grams;
  let approximate = false;
  if (typeof MASS_GRAMS[unit] === 'number') {
    grams = amount * MASS_GRAMS[unit];
  } else if (typeof VOLUME_ML[unit] === 'number') {
    grams = amount * VOLUME_ML[unit];
    approximate = true;
  } else if (unit === 'each') {
    const perItem = food?.servingGrams;
    if (typeof perItem !== 'number' || !(perItem > 0)) {
      return { grams: null, approximate: false, reason: 'serving' };
    }
    grams = amount * perItem;
  } else {
    return { grams: null, approximate: false, reason: 'unit' };
  }

  const rounded = Math.round(grams * 10) / 10;
  if (!(rounded > 0)) return { grams: null, approximate: false, reason: 'amount' };
  return { grams: rounded, approximate, reason: null };
}

// Picks the match for an ingredient name from searchFoods results (library rows first).
// 'sure': a Food Library food whose name is the same as the ingredient's (folded).
// 'unsure': the best result is a guess (the first one is preselected). 'none': no results.
export function chooseMatch(name, results) {
  const list = Array.isArray(results) ? results : [];
  const folded = norm(name).trim();
  const exact = list.find(
    (result) => result.source === 'library' && norm(result.name).trim() === folded
  );
  if (exact) return { status: 'sure', food: exact };
  if (list.length > 0) return { status: 'unsure', food: list[0] };
  return { status: 'none', food: null };
}

// One review row for a parsed ingredient line, before any search.
export function newRow(line, index) {
  return {
    key: `line-${index}`,
    text: line.text,
    name: line.name,
    amount: line.amount,
    unit: line.unit,
    query: line.name,
    food: null,
    candidates: [],
    status: 'none',
    searchFailed: false,
    grams: '',
    gramsEdited: false,
    approximate: false,
    reason: null,
  };
}

// Recomputes the grams of a row from its food and line, unless the Member typed grams.
export function withConversion(row) {
  const conversion = gramsFor(row, row.food);
  if (row.gramsEdited) {
    return { ...row, approximate: false, reason: null };
  }
  return {
    ...row,
    grams: conversion.grams === null ? '' : String(conversion.grams),
    approximate: conversion.approximate,
    reason: row.food ? conversion.reason : null,
  };
}

// The Member picks a food for the row. A pick is a confirmed match, so it is no longer
// flagged as a guess.
export function rowWithFood(row, food) {
  return withConversion({ ...row, food, status: food ? 'sure' : 'none' });
}

// The Member types the grams. Typed grams replace the conversion.
export function rowWithGrams(row, grams) {
  return { ...row, grams, gramsEdited: true, approximate: false, reason: null };
}

// Whether the Member should look at the row: no food, a guessed food, a missing or
// approximate conversion, or a search that failed.
export function rowNeedsCheck(row) {
  return (
    !row.food ||
    row.status !== 'sure' ||
    row.reason !== null ||
    row.approximate === true ||
    row.searchFailed === true
  );
}

// Whether the review can move on to the Recipe editor. Every kept line needs a food; grams
// that are still blank are left for the editor to ask for.
export function canContinue(rows) {
  if (rows.length === 0) return { ok: false, reason: 'empty' };
  if (rows.some((row) => !row.food)) return { ok: false, reason: 'noFood' };
  return { ok: true, reason: null };
}

// Splits a search result into what a row shows. A failed search keeps the other source.
function applyFound(row, found, pickName) {
  const results = Array.isArray(found?.results) ? found.results : [];
  const searchFailed = Boolean(found?.libraryFailed && found?.usdaFailed);
  if (pickName === null) {
    // A new search from the Member: the candidates change, the chosen food stays.
    return withConversion({ ...row, candidates: results.slice(0, CANDIDATE_LIMIT), searchFailed });
  }
  const match = chooseMatch(pickName, results);
  return withConversion({
    ...row,
    candidates: results.slice(0, CANDIDATE_LIMIT),
    food: match.food,
    status: match.status,
    searchFailed,
  });
}

// Searches for each parsed line and returns the review rows. Lines are searched together;
// a failed search leaves that row with no food and searchFailed set.
export async function matchRecipeLines(client, lines, search = searchFoods) {
  return Promise.all(
    lines.map(async (line, index) => {
      const row = newRow(line, index);
      try {
        const found = await search(client, line.name);
        return applyFound(row, found, line.name);
      } catch {
        return { ...withConversion(row), searchFailed: true };
      }
    })
  );
}

// The Member's own search for a row's ingredient. Updates the candidates only.
export async function searchCandidates(client, row, query, search = searchFoods) {
  const text = String(query ?? '').trim();
  if (text === '') return { ...row, query: '', candidates: [], searchFailed: false };
  try {
    const found = await search(client, text);
    return { ...applyFound({ ...row, query: text }, found, null) };
  } catch {
    return { ...row, query: text, candidates: [], searchFailed: true };
  }
}

// Turns a parse reply into the Recipe editor's draft. Nothing is saved here; the editor's
// Save does that.
export function draftFromParsed(parsed, ingredients) {
  return {
    ...emptyRecipeDraft(),
    name: parsed.name ?? '',
    servings:
      parsed.servings === null || parsed.servings === undefined ? '' : String(parsed.servings),
    notes: parsed.notes ?? '',
    ingredients,
  };
}

// Reads the Food Library rows for the chosen foods and returns the editor's ingredient lines.
// A USDA food the Member picked is saved to the Food Library first (usda_save returns the
// existing row when the food is already there). Nutrition comes from those rows.
export async function resolveIngredients(client, rows, save = saveUsdaFood) {
  const ids = [];
  for (const row of rows) {
    if (!row.food) throw new Error('A line has no food');
    if (row.food.source === 'library') {
      ids.push(row.food.id);
    } else {
      ids.push(await save(client, Number(row.food.fdcId)));
    }
  }

  const uniqueIds = [...new Set(ids)];
  const { data, error } = await client.from('foods').select(RAW_FOOD_COLUMNS).in('id', uniqueIds);
  if (error) throw error;
  const byId = new Map((data || []).map((food) => [food.id, food]));

  return rows.map((row, index) => {
    const food = byId.get(ids[index]);
    if (!food) throw new Error('A matched food could not be read');
    return { key: nextKey(), id: null, food, grams: row.grams };
  });
}

// Error with a short code the screen maps to a message: 'cap' (AI limit), 'failed'.
export class PasteError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PasteError';
    this.code = code;
  }
}

async function errorCode(error) {
  try {
    const body = await error?.context?.json();
    return body?.code ?? null;
  } catch {
    return null;
  }
}

// Sends the pasted text to the parse-recipe Edge Function. Returns the reply's fields.
// A refused call over the AI cap becomes PasteError('cap').
export async function parseRecipeText(client, text) {
  let response;
  try {
    response = await client.functions.invoke('parse-recipe', { body: { text } });
  } catch {
    throw new PasteError('failed');
  }
  const { data, error } = response ?? {};
  if (error) {
    const code = await errorCode(error);
    throw new PasteError(code === 'AI_LIMIT_REACHED' ? 'cap' : 'failed');
  }
  if (!data || !Array.isArray(data.ingredients)) throw new PasteError('failed');
  return {
    name: String(data.name ?? ''),
    servings: data.servings ?? null,
    notes: data.notes ?? null,
    ingredients: data.ingredients,
  };
}
