// Pure rules for the Preferences page: the fixed lists, list parsing, validation and the
// conversion between stored rows and form values. No React and no Supabase here.
// Validation returns translation keys (under preferences.errors.*); the page calls t().
// The fixed lists match the check constraints in migration 037; keep them in step.

export const DIET_RULES = [
  'vegetarian',
  'vegan',
  'pescatarian',
  'halal',
  'kosher',
  'gluten_free',
  'dairy_free',
];
export const FOOD_GROUPS = [
  'dairy',
  'eggs',
  'fish',
  'shellfish',
  'peanuts',
  'tree_nuts',
  'wheat_gluten',
  'soy',
  'sesame',
  'pork',
  'beef',
  'poultry',
];
export const EQUIPMENT = [
  'oven',
  'stovetop',
  'slow_cooker',
  'pressure_cooker',
  'air_fryer',
  'microwave',
  'grill',
  'blender',
  'rice_cooker',
];
export const REPEAT_FREQUENCIES = ['rarely', 'sometimes', 'often'];
export const LEFTOVERS_LEVELS = ['none', 'some', 'plenty'];
export const BUDGET_FEELS = ['tight', 'moderate', 'relaxed'];

export const MAX_LIST_ITEMS = 50;
export const MAX_ITEM_LENGTH = 60;
export const MIN_MINUTES = 5;
export const MAX_MINUTES = 480;

// "thai, Italian\nthai" becomes ['thai', 'Italian']: trimmed, spaces collapsed, no blanks,
// no repeats (ignoring case). Order is kept.
export function parseList(text) {
  const seen = new Set();
  const items = [];
  for (const piece of String(text ?? '').split(/[,\n;]/)) {
    const item = piece.trim().replace(/\s+/g, ' ');
    const key = item.toLowerCase();
    if (item === '' || seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}

export const listToText = (items) => (Array.isArray(items) ? items.join(', ') : '');

// Checks a parsed list. Returns an error key or null.
export function listError(items) {
  if (items.length > MAX_LIST_ITEMS) return 'preferences.errors.tooManyItems';
  if (items.some((item) => item.length > MAX_ITEM_LENGTH)) return 'preferences.errors.itemTooLong';
  return null;
}

// A cooking time in whole minutes. Empty means "not set" (null).
export function parseMinutes(text) {
  const trimmed = String(text ?? '').trim();
  if (trimmed === '') return { ok: true, value: null };
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: 'preferences.errors.minutesWhole' };
  const value = Number(trimmed);
  if (value < MIN_MINUTES || value > MAX_MINUTES) {
    return { ok: false, error: 'preferences.errors.minutesRange' };
  }
  return { ok: true, value };
}

const orEmpty = (value) => (value === null || value === undefined ? '' : String(value));
const pick = (value, allowed) => (allowed.includes(value) ? value : '');
const only = (values, allowed) => allowed.filter((item) => (values ?? []).includes(item));

export function emptyHouseholdForm() {
  return {
    cuisines: '',
    weeknightMinutes: '',
    weekendMinutes: '',
    equipment: [],
    repeatFrequency: '',
    leftoversTolerance: '',
    budgetFeel: '',
  };
}

export function householdRowToForm(row) {
  if (!row) return emptyHouseholdForm();
  return {
    cuisines: listToText(row.cuisines),
    weeknightMinutes: orEmpty(row.weeknight_minutes),
    weekendMinutes: orEmpty(row.weekend_minutes),
    equipment: only(row.equipment, EQUIPMENT),
    repeatFrequency: pick(row.repeat_frequency, REPEAT_FREQUENCIES),
    leftoversTolerance: pick(row.leftovers_tolerance, LEFTOVERS_LEVELS),
    budgetFeel: pick(row.budget_feel, BUDGET_FEELS),
  };
}

// Returns { ok, values, errors }. values holds the columns to save; errors maps a form field
// to a translation key.
export function validateHousehold(form) {
  const errors = {};
  const cuisines = parseList(form.cuisines);
  const cuisinesError = listError(cuisines);
  if (cuisinesError) errors.cuisines = cuisinesError;

  const weeknight = parseMinutes(form.weeknightMinutes);
  if (!weeknight.ok) errors.weeknightMinutes = weeknight.error;
  const weekend = parseMinutes(form.weekendMinutes);
  if (!weekend.ok) errors.weekendMinutes = weekend.error;

  const values = {
    cuisines,
    weeknight_minutes: weeknight.ok ? weeknight.value : null,
    weekend_minutes: weekend.ok ? weekend.value : null,
    equipment: only(form.equipment, EQUIPMENT),
    repeat_frequency: pick(form.repeatFrequency, REPEAT_FREQUENCIES) || null,
    leftovers_tolerance: pick(form.leftoversTolerance, LEFTOVERS_LEVELS) || null,
    budget_feel: pick(form.budgetFeel, BUDGET_FEELS) || null,
  };
  return { ok: Object.keys(errors).length === 0, values, errors };
}

export function emptyMemberForm() {
  return { favourites: '', dislikes: '', hardFoods: '', hardFoodGroups: [], hardDiets: [] };
}

export function memberRowToForm(row) {
  if (!row) return emptyMemberForm();
  return {
    favourites: listToText(row.favourites),
    dislikes: listToText(row.dislikes),
    hardFoods: listToText(row.hard_foods),
    hardFoodGroups: only(row.hard_food_groups, FOOD_GROUPS),
    hardDiets: only(row.hard_diets, DIET_RULES),
  };
}

export function validateMember(form) {
  const errors = {};
  const lists = {
    favourites: parseList(form.favourites),
    dislikes: parseList(form.dislikes),
    hardFoods: parseList(form.hardFoods),
  };
  for (const [field, items] of Object.entries(lists)) {
    const error = listError(items);
    if (error) errors[field] = error;
  }
  const values = {
    favourites: lists.favourites,
    dislikes: lists.dislikes,
    hard_foods: lists.hardFoods,
    hard_food_groups: only(form.hardFoodGroups, FOOD_GROUPS),
    hard_diets: only(form.hardDiets, DIET_RULES),
  };
  return { ok: Object.keys(errors).length === 0, values, errors };
}
