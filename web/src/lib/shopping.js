// Shopping list data access. Takes the Supabase client first so tests can pass a fake. Row-level
// security limits reads to the caller's Household, so every Member reads the same lines. Lines
// are built in the database when a Meal Plan is approved or grows (migration 044).

import { lineFromRow } from './shoppingLogic.js';

export const SHOPPING_SELECT =
  'id, item_name, quantity_needed, purchased, food_id, source, grams, need_grams, store_section, created_at, measure_kind, measure_label, measure_count, client_id';

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

// A hand-added line (migration 047). clientId is made on the phone, so a queued add that is sent
// twice still makes one line. Returns { lineId, created }; created is false for a repeat.
export async function addHandLine(
  client,
  { clientId, name, foodId = null, grams = null, text = null }
) {
  const { data, error } = await client.rpc('shopping_add_line', {
    p_client_id: clientId,
    p_name: name,
    p_food_id: foodId,
    p_grams: grams,
    p_text: text,
  });
  if (error) throw error;
  return { lineId: data?.line_id ?? null, created: Boolean(data?.created) };
}

// Sends one queued shopping operation (see queuedTick and queuedAdd in shoppingLogic.js). A tick
// the database already has, or an add it already has, comes back as a normal answer, so a replay
// after a lost reply is harmless.
export async function sendShoppingOp(client, row) {
  if (row.op === 'tick') {
    await tickLine(client, row.lineId, row.kind, row.grams ?? null);
  } else if (row.op === 'add') {
    await addHandLine(client, {
      clientId: row.clientId,
      name: row.name,
      foodId: row.foodId,
      grams: row.grams,
      text: row.text,
    });
  } else {
    throw Object.assign(new Error(`Unknown shopping operation: ${row.op}`), { code: 'XX000' });
  }
}

// The last list seen online, kept on the phone so the screen can open with no signal and still be
// ticked (ticket 48). Reads never throw; a write the browser refuses is ignored.
export const LIST_CACHE_KEY = 'calorie-manager.shopping-list';

export function readCachedList(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(LIST_CACHE_KEY));
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeCachedList(lines, storage = globalThis.localStorage) {
  try {
    storage.setItem(LIST_CACHE_KEY, JSON.stringify(lines));
  } catch {
    // The list just will not open offline.
  }
}
