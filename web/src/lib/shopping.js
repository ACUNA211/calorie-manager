// Shopping list data access. Takes the Supabase client first so tests can pass a fake. Row-level
// security limits reads to the caller's Household, so every Member reads the same lines. Lines
// are built in the database when a Meal Plan is approved or grows (migration 044).

import { lineFromRow } from './shoppingLogic.js';

export const SHOPPING_SELECT =
  'id, item_name, quantity_needed, purchased, food_id, source, grams, need_grams, store_section, created_at, measure_kind, measure_label, measure_count';

export async function loadShoppingList(client) {
  const { data, error } = await client
    .from('grocery_list')
    .select(SHOPPING_SELECT)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data || []).map(lineFromRow);
}

// One tick, one call, so a queued tick can be replayed later (ticket 48). kind is 'bought' or
// 'have_it'; scannedGrams (ticket 49) replaces the planned amount. Returns
// { applied, pantryGrams, pantryDelta }; applied is false when the line was already ticked.
export async function tickLine(client, lineId, kind, scannedGrams = null) {
  const { data, error } = await client.rpc('shopping_tick', {
    p_line_id: lineId,
    p_kind: kind,
    p_grams: scannedGrams,
  });
  if (error) throw error;
  return {
    applied: Boolean(data?.applied),
    pantryGrams: data?.pantry_grams === undefined ? null : Number(data.pantry_grams),
    pantryDelta: data?.pantry_delta === undefined ? 0 : Number(data.pantry_delta),
  };
}

// Undo of the latest tick, allowed for a few seconds. Returns the Pantry grams afterwards.
export async function untickLine(client, lineId) {
  const { data, error } = await client.rpc('shopping_untick', { p_line_id: lineId });
  if (error) throw error;
  return data?.pantry_grams === undefined || data.pantry_grams === null
    ? null
    : Number(data.pantry_grams);
}
