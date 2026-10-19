// Shopping list data access. Takes the Supabase client first so tests can pass a fake. Row-level
// security limits reads to the caller's Household, so every Member reads the same lines. Lines
// are built in the database when a Meal Plan is approved or grows (migration 044).

import { lineFromRow } from './shoppingLogic.js';

export const SHOPPING_SELECT =
  'id, item_name, quantity_needed, purchased, food_id, source, grams, store_section, created_at, measure_kind, measure_label, measure_count';

export async function loadShoppingList(client) {
  const { data, error } = await client
    .from('grocery_list')
    .select(SHOPPING_SELECT)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data || []).map(lineFromRow);
}
