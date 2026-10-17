// Food Library search and saving. Pure helpers (ranking, merging, per-serving maths) sit
// beside the data access, which takes the Supabase client as its first argument so tests
// can pass a fake. Nothing here knows about the screen.
//
// Every number is per 100 g unless a result says serving. A missing macro is null, never
// 0: USDA search hits carry calories only, so a USDA result shows no macros until saved.

import { norm, searchTokens } from './norm.js';

export const FOOD_COLUMNS =
  'id, name, brand, source, source_id, kcal_per_100g, servings, protein_g, carbs_g, fat_g, fibre_g, sugars_g, sodium_mg';
export const USDA_RESULT_LIMIT = 12;
// The Food Library is searched in the app (accents folded), so every row of this
// Household is read. Above this many foods, search misses the rest; see the ticket notes.
export const LIBRARY_SCAN_LIMIT = 2000;

export const MACRO_KEYS = ['protein', 'carbs', 'fat', 'fibre', 'sugars', 'sodium'];
const MACRO_COLUMNS = {
  protein: 'protein_g',
  carbs: 'carbs_g',
  fat: 'fat_g',
  fibre: 'fibre_g',
  sugars: 'sugars_g',
  sodium: 'sodium_mg',
};

const numberOrNull = (value) => (value === null || value === undefined ? null : Number(value));

// A Food Library row becomes a search result. Its first serving (if any) is the serving.
export function libraryResult(row) {
  const serving = Array.isArray(row.servings) ? row.servings[0] : undefined;
  const macros = {};
  for (const key of MACRO_KEYS) macros[key] = numberOrNull(row[MACRO_COLUMNS[key]]);
  return {
    key: `library:${row.id}`,
    source: 'library',
    id: row.id,
    usdaId: row.source === 'usda' && row.source_id ? String(row.source_id) : null,
    name: row.name,
    brand: row.brand || null,
    kcalPer100g: numberOrNull(row.kcal_per_100g),
    macros,
    servingGrams: serving ? numberOrNull(serving.grams) : null,
    servingLabel: serving ? serving.label : null,
  };
}

// A usda_search hit (see usda_hit in migration 003) becomes a search result. Hits carry
// no macros, so they are null until the food is saved.
export function usdaResult(hit) {
  return {
    key: `usda:${hit.fdc_id}`,
    source: 'usda',
    fdcId: Number(hit.fdc_id),
    usdaId: String(hit.fdc_id),
    name: hit.name,
    brand: hit.brand || null,
    kcalPer100g: numberOrNull(hit.kcal_per_100g),
    macros: null,
    servingGrams: numberOrNull(hit.serving_g),
    servingLabel: hit.serving_label || null,
  };
}

// True when every search word appears in the folded name or brand.
export function matchesTokens(result, tokens) {
  const haystack = norm(`${result.name} ${result.brand || ''}`);
  return tokens.every((token) => haystack.includes(token));
}

// Library matches for a query, best first: a name starting with the first word ranks
// above a word found later; ties go alphabetically by name.
export function rankLibrary(results, query) {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [];
  return results
    .filter((result) => matchesTokens(result, tokens))
    .map((result) => ({
      result,
      score: norm(result.name).startsWith(tokens[0]) ? 2 : 0,
    }))
    .sort((a, b) => b.score - a.score || a.result.name.localeCompare(b.result.name))
    .map(({ result }) => result);
}

// Library results first, then USDA results. A USDA hit already saved to the Food Library
// is left out, so the list never shows the same food twice.
export function mergeResults(library, usda) {
  const savedUsdaIds = new Set(library.map((result) => result.usdaId).filter(Boolean));
  return [...library, ...usda.filter((result) => !savedUsdaIds.has(result.usdaId))];
}

// One grams-based value: value × grams ÷ 100, to one decimal. Null stays null.
export function scaleToGrams(value, grams) {
  if (value === null || value === undefined || grams === null || grams === undefined) {
    return null;
  }
  return Math.round(((value * grams) / 100) * 10) / 10;
}

// The numbers a screen shows: per 100 g, and per serving when the result has a serving size.
export function nutritionFor(result) {
  const values = (factor) => {
    const out = { kcal: factor(result.kcalPer100g) };
    for (const key of MACRO_KEYS) {
      out[key] = result.macros ? factor(result.macros[key]) : null;
    }
    return out;
  };
  const grams = result.servingGrams;
  const hasServing = grams !== null && grams !== undefined && grams > 0;
  return {
    per100g: values((value) => value ?? null),
    perServing: hasServing
      ? {
          grams,
          label: result.servingLabel,
          ...values((value) => scaleToGrams(value, grams)),
        }
      : null,
  };
}

// Reads the Food Library for this Household and keeps the rows matching the query.
export async function searchLibrary(client, query) {
  if (searchTokens(query).length === 0) return [];
  const { data, error } = await client
    .from('foods')
    .select(FOOD_COLUMNS)
    .order('name', { ascending: true })
    .limit(LIBRARY_SCAN_LIMIT);
  if (error) throw error;
  return rankLibrary((data || []).map(libraryResult), query);
}

// Calls the USDA search function (migration 003). Throws when the call fails.
export async function searchUsda(client, query) {
  const text = String(query || '').trim();
  if (text === '') return [];
  const { data, error } = await client.rpc('usda_search', {
    p_query: text,
    p_page_size: USDA_RESULT_LIMIT,
  });
  if (error) throw error;
  return (data || []).map(usdaResult);
}

// Searches the Food Library and USDA side by side. A failure in one source does not hide
// the other: the result says which source failed.
export async function searchFoods(client, query) {
  const [library, usda] = await Promise.allSettled([
    searchLibrary(client, query),
    searchUsda(client, query),
  ]);
  const libraryResults = library.status === 'fulfilled' ? library.value : [];
  const usdaResults = usda.status === 'fulfilled' ? usda.value : [];
  return {
    results: mergeResults(libraryResults, usdaResults),
    libraryFailed: library.status === 'rejected',
    usdaFailed: usda.status === 'rejected',
  };
}

// Saves a USDA food to the Food Library (usda_save returns the existing row when the food
// is already there, so a second save adds nothing). Returns the Food Library id.
export async function saveUsdaFood(client, fdcId) {
  const { data, error } = await client.rpc('usda_save', { p_fdc_id: fdcId });
  if (error) throw error;
  return data;
}
