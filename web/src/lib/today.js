// Today's data access: one Member's Calorie Log for one day, and writing an entry. Every
// function takes the Supabase client as its first argument so tests can pass a fake. Row-
// level security (migration 007) limits the rows to Members the caller may act for.
// Targets and Meal Times are read with targets.js and mealTimes.js; this file does not repeat them.

import { FOOD_COLUMNS, libraryResult, saveUsdaFood } from './foods.js';

export const ENTRY_COLUMNS =
  'id, log_date, meal_time_id, log_time, food_id, description, servings, grams, kcal, protein_g, carbs_g, fat_g, created_at';

// The Calorie Log entries of one Member on one day, in the order they were logged.
export async function loadDay(client, memberId, logDate) {
  const { data, error } = await client
    .from('calorie_log')
    .select(ENTRY_COLUMNS)
    .eq('member_id', memberId)
    .eq('log_date', logDate)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Adds one entry (a row from buildLogRow) and returns it as stored.
export async function insertEntry(client, row) {
  const { data, error } = await client
    .from('calorie_log')
    .insert(row)
    .select(ENTRY_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

// Sends an entry that was queued on the phone (offline logging, ticket #34). The row carries a
// client_id, so a resend the server already stored is refused with 23505; that counts as sent.
// Any other error is thrown as it is.
export async function insertQueuedEntry(client, row) {
  try {
    await insertEntry(client, row);
  } catch (error) {
    if (error?.code === '23505') return;
    throw error;
  }
}

// One Food Library row, as a search result (with its macros).
export async function loadFood(client, foodId) {
  const { data, error } = await client.from('foods').select(FOOD_COLUMNS).eq('id', foodId).single();
  if (error) throw error;
  return libraryResult(data);
}

// The Food Library version of a search result. A Food Library result is returned as it is.
// A USDA result is saved to the Food Library first (usda_save adds nothing if it is already
// there), so the entry gets the food's calories and macros.
export async function libraryFoodFor(client, result) {
  if (result.source === 'library') return result;
  const foodId = await saveUsdaFood(client, result.fdcId);
  return loadFood(client, foodId);
}

// Changes the amount or Meal Time of one entry (a patch from editEntryPatch) and returns the
// row as stored. Row-level security stops a Member changing another Member's entry; a row
// it refuses comes back as an error, not as a silent no-op.
export async function updateEntry(client, id, patch) {
  const { data, error } = await client
    .from('calorie_log')
    .update(patch)
    .eq('id', id)
    .select(ENTRY_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

// Deletes one entry. Returns nothing; throws when no row was deleted (for example, when
// row-level security refused it), so a failed delete is never shown as done.
export async function deleteEntry(client, id) {
  const { data, error } = await client.from('calorie_log').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('calorie_log row was not deleted');
}

// Puts a deleted entry back (a row from restoreRow) and returns it as stored.
export async function restoreEntry(client, row) {
  const { data, error } = await client
    .from('calorie_log')
    .insert(row)
    .select(ENTRY_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}
