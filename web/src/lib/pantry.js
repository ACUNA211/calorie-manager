// Pantry data access. Every function takes the Supabase client as its first argument so
// tests can pass a fake. Row-level security limits reads to the caller's Household; writes
// go through the pantry_add and pantry_correct functions (migration 019).

import { saveUsdaFood } from './foods.js';

export const PANTRY_SELECT = 'id, food_id, grams, foods(name, brand, store_section)';

// A pantry_items row with its food, as the screen uses it.
export function pantryItemFromRow(row) {
  const food = row.foods || {};
  return {
    id: row.id,
    foodId: row.food_id,
    grams: Number(row.grams),
    name: food.name || '',
    brand: food.brand || null,
    storeSection: food.store_section || 'Other',
  };
}

export async function loadPantry(client) {
  const { data, error } = await client
    .from('pantry_items')
    .select(PANTRY_SELECT)
    .order('id', { ascending: true });
  if (error) throw error;
  return (data || []).map(pantryItemFromRow);
}

// A search result becomes a Food Library id. A USDA result is saved to the Food Library
// first (saving twice adds nothing), so the Pantry always points at a Food Library row.
export async function foodIdFor(client, result) {
  if (result.source === 'library') return result.id;
  return saveUsdaFood(client, result.fdcId);
}

// Adds grams of a food to the Pantry. Returns the Pantry item's id.
export async function addToPantry(client, foodId, grams) {
  const { data, error } = await client.rpc('pantry_add', { p_food_id: foodId, p_grams: grams });
  if (error) throw error;
  return data;
}

// Corrects an item: action is 'used_up', 'half' or 'set' (with typedGrams). Returns the
// new amount in grams.
export async function correctPantryItem(client, itemId, action, typedGrams = null) {
  const { data, error } = await client.rpc('pantry_correct', {
    p_item_id: itemId,
    p_action: action,
    p_grams: typedGrams,
  });
  if (error) throw error;
  return Number(data);
}

// The food fields a package scan needs: its name, the package weight the Household set (if
// any) and its serving data. Ticket #26 reads these to add one package at its label weight.
export async function loadFoodPackage(client, foodId) {
  const { data, error } = await client
    .from('foods')
    .select('id, name, package_grams, servings')
    .eq('id', Number(foodId))
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    packageGrams: data.package_grams === null ? null : Number(data.package_grams),
    servings: data.servings || [],
  };
}

// Remembers the label weight of one package on the food (migration 027). Returns it.
export async function setPackageGrams(client, foodId, grams) {
  const { data, error } = await client.rpc('set_package_grams', {
    p_food_id: Number(foodId),
    p_grams: grams,
  });
  if (error) throw error;
  return Number(data);
}
