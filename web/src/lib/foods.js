// Food Library search and saving. Pure helpers (ranking, merging, per-serving maths) sit
// beside the data access, which takes the Supabase client as its first argument so tests
// can pass a fake. Nothing here knows about the screen.
//
// Every number is per 100 g unless a result says serving. A missing macro is null, never
// 0: USDA search hits carry calories only, so a USDA result shows no macros until saved.

import { norm, searchTokens } from './norm.js';
import { gtinForms, isValidGtin } from './gtin.js';
import { lookupOff } from './off.js';

export const FOOD_COLUMNS =
  'id, name, name_es, name_es_edited_by_member, brand, source, source_id, kcal_per_100g, servings, protein_g, carbs_g, fat_g, fibre_g, sugars_g, sodium_mg';
// Migration 017: the Spanish name is filled by translate-food-name. Its Edge Function
// name is here so the page and the function agree.
export const TRANSLATE_FUNCTION = 'translate-food-name';
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
    nameEs: row.name_es || null,
    nameEsEdited: row.name_es_edited_by_member === true,
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
    nameEs: null,
    nameEsEdited: false,
    brand: hit.brand || null,
    kcalPer100g: numberOrNull(hit.kcal_per_100g),
    macros: null,
    servingGrams: numberOrNull(hit.serving_g),
    servingLabel: hit.serving_label || null,
  };
}

// The English and Spanish names (when there is one) and the brand, folded for search.
function searchableNames(result) {
  return [result.name, result.nameEs, result.brand].filter(Boolean).map((text) => norm(text));
}

// True when every search word appears in the folded English name, Spanish name or brand.
// Each word may match a different one of them ("manzana" finds "Apples, raw").
export function matchesTokens(result, tokens) {
  const haystack = searchableNames(result).join(' ');
  return tokens.every((token) => haystack.includes(token));
}

// Library matches for a query, best first: a name (English or Spanish) starting with the
// first word ranks above a word found later; ties go alphabetically by English name.
export function rankLibrary(results, query) {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [];
  return results
    .filter((result) => matchesTokens(result, tokens))
    .map((result) => ({
      result,
      score: [norm(result.name), result.nameEs ? norm(result.nameEs) : ''].some((name) =>
        name.startsWith(tokens[0])
      )
        ? 2
        : 0,
    }))
    .sort((a, b) => b.score - a.score || a.result.name.localeCompare(b.result.name))
    .map(({ result }) => result);
}

// The name a screen shows: the Spanish name on a Spanish screen when there is one.
export function displayName(result, locale) {
  return locale === 'es' && result.nameEs ? result.nameEs : result.name;
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

// Looks up a scanned barcode (ticket 18). usda_lookup_gtin (migration 003) checks this
// Household's Food Library first and asks USDA only when that misses, so a library hit
// makes no USDA call. Every zero-padded form of a code is the same key on the server, so
// one call with the 14-digit form covers the 12- and 13-digit forms too.
// When USDA misses, Open Food Facts is asked (ticket 19, off-lookup). Its failure does not
// fail the lookup: the answer then carries offStatus ('rateLimited' or 'unavailable') so the
// screen can say "try again" rather than "no such food".
// Returns { status: 'found', source: 'library' | 'usda' | 'off', result } (a result as
// libraryResult, usdaResult or offResult gives), { status: 'notFound', offStatus? } or
// { status: 'invalid' }. Throws when the USDA call fails.
export async function lookupGtin(client, code) {
  if (!isValidGtin(code)) return { status: 'invalid' };
  const [, , fourteen] = gtinForms(code);
  const { data, error } = await client.rpc('usda_lookup_gtin', { p_code: fourteen });
  if (error) throw error;
  if (!data) return lookupOffFallback(client, code);
  if (data.food_id !== undefined && data.food_id !== null) {
    const { data: row, error: rowError } = await client
      .from('foods')
      .select(FOOD_COLUMNS)
      .eq('id', Number(data.food_id))
      .single();
    if (rowError) throw rowError;
    return { status: 'found', source: 'library', result: libraryResult(row) };
  }
  return { status: 'found', source: 'usda', result: usdaResult(data) };
}

// The Open Food Facts step of lookupGtin. Any failure is an answer, never a throw.
async function lookupOffFallback(client, code) {
  try {
    const outcome = await lookupOff(client, code);
    if (outcome.status === 'found')
      return { status: 'found', source: 'off', result: outcome.result };
    return outcome;
  } catch {
    return { status: 'notFound', offStatus: 'unavailable' };
  }
}

// Saves a USDA food to the Food Library (usda_save returns the existing row when the food
// is already there, so a second save adds nothing). Returns the Food Library id.
export async function saveUsdaFood(client, fdcId) {
  const { data, error } = await client.rpc('usda_save', { p_fdc_id: fdcId });
  if (error) throw error;
  return data;
}

// Asks translate-food-name for the Spanish name of a saved food. The function answers with
// a status ('translated', 'failed', 'limit_reached' or 'kept') and never fails the save.
export async function translateFoodName(client, foodId) {
  const { data, error } = await client.functions.invoke(TRANSLATE_FUNCTION, {
    body: { food_id: Number(foodId) },
  });
  if (error) throw error;
  return data ?? { status: 'failed' };
}

// Saves a USDA food, then asks for its Spanish name. A failed translation leaves the food
// saved with no Spanish name; the answer says what happened.
export async function saveUsdaFoodAndTranslate(client, fdcId) {
  const id = await saveUsdaFood(client, fdcId);
  let spanish;
  try {
    spanish = (await translateFoodName(client, id)).status;
  } catch {
    spanish = 'failed';
  }
  return { id, spanish };
}

// A Member's edit of the English and Spanish names of a Food Library food. An empty Spanish
// name clears it. The database marks the Spanish name as the Member's when it changes, so the
// translator never overwrites it.
export async function saveFoodNames(client, foodId, { name, nameEs }) {
  const englishName = String(name ?? '').trim();
  if (englishName === '') throw new Error('The English name cannot be empty');
  const spanishName = String(nameEs ?? '').trim();
  const { error } = await client
    .from('foods')
    .update({ name: englishName, name_es: spanishName === '' ? null : spanishName })
    .eq('id', Number(foodId));
  if (error) throw error;
}
