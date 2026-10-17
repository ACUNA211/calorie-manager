// Recipes: the editor's pure helpers (form strings in, values out) and the data access.
// Data functions take the Supabase client as their first argument so tests can pass a fake.
// The Household is applied by row-level security (migration 006): the household_id column
// defaults to the caller's Household, so inserts do not set it.

export const NAME_MAX = 120;
export const NOTES_MAX = 2000;
export const GRAMS_MAX = 100000;
export const SERVINGS_MAX = 1000;

const RECIPE_COLUMNS = 'id, name, starred, servings, cooked_weight_g, notes, copied_from';
const MEAL_TIME_COLUMNS = 'id, name, time_of_day';
const FOOD_COLUMNS =
  'id, name, brand, kcal_per_100g, protein_g, carbs_g, fat_g, fibre_g, sugars_g, sodium_mg';

let keyCounter = 0;
// A key for React lists that stays put while an ingredient is edited.
export function nextKey() {
  keyCounter += 1;
  return `ingredient-${keyCounter}`;
}

import { parseMassKeeping, toInputMass } from './units.js';

// A gram field (an ingredient's amount or the cooked weight), read in the Member's units.
// Empty gives null (not given). The stored grams are kept when the text is still as shown.
export function parseGramsField(text, units, stored) {
  if (String(text ?? '').trim() === '') return { ok: true, value: null };
  const parsed = parseMassKeeping(text, units, stored);
  if (!parsed.ok) return { ok: false, error: 'units.errors.mass' };
  return { ok: true, value: parsed.grams };
}

// A plain positive-number field: "250", "2.5". Empty gives null (not given).
// Anything else (negative, "1,5", "2 cups") is an error, so the caller can say so.
export function parseAmount(text) {
  const trimmed = String(text ?? '').trim();
  if (trimmed === '') return { ok: true, value: null };
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return { ok: false, error: 'recipes.errors.number' };
  const value = Number(trimmed);
  if (value <= 0) return { ok: false, error: 'recipes.errors.notPositive' };
  return { ok: true, value };
}

// The suffix is the translated " (variation)", passed in so this file stays free of text.
export function variationName(name, suffix) {
  const base = String(name ?? '').trim();
  return `${base.slice(0, NAME_MAX - suffix.length)}${suffix}`;
}

// Meal Time ids as a sorted list with no repeats, the form the database expects.
export function uniqueIds(ids) {
  return [...new Set(ids ?? [])].sort((a, b) => a - b);
}

export function emptyRecipeDraft() {
  return {
    id: null,
    name: '',
    starred: false,
    servings: '1',
    cookedWeight: '',
    notes: '',
    mealTimeIds: [],
    ingredients: [],
  };
}

// Toggles one Meal Time tag on a draft (the checkbox for it).
export function toggleMealTime(draft, mealTimeId, on) {
  const current = draft.mealTimeIds ?? [];
  const next = on ? uniqueIds([...current, mealTimeId]) : current.filter((id) => id !== mealTimeId);
  return { ...draft, mealTimeIds: next };
}

// A stored Recipe (as loaded by loadRecipes) becomes an editor draft.
// The grams shown in the editor are in the Member's units; storedGrams keeps the exact stored
// value while the text is unchanged.
export function draftFromRecipe(recipe, units = 'metric') {
  const cooked = recipe.cooked_weight_g == null ? null : Number(recipe.cooked_weight_g);
  return {
    id: recipe.id,
    name: recipe.name,
    starred: Boolean(recipe.starred),
    servings: String(recipe.servings),
    cookedWeight: toInputMass(cooked, units),
    storedCookedWeight: cooked,
    notes: recipe.notes ?? '',
    mealTimeIds: uniqueIds((recipe.meal_time_tags ?? []).map((tag) => tag.id)),
    ingredients: (recipe.ingredients ?? []).map((item) => ({
      key: nextKey(),
      id: item.id,
      food: item.food,
      grams: toInputMass(item.grams, units),
      storedGrams: Number(item.grams),
    })),
  };
}

// Adds a Food Library food as a new ingredient line with no grams yet.
export function addIngredient(draft, food) {
  return {
    ...draft,
    ingredients: [...draft.ingredients, { key: nextKey(), id: null, food, grams: '' }],
  };
}

export function removeIngredient(draft, key) {
  return { ...draft, ingredients: draft.ingredients.filter((item) => item.key !== key) };
}

export function setIngredientGrams(draft, key, grams) {
  return {
    ...draft,
    ingredients: draft.ingredients.map((item) => (item.key === key ? { ...item, grams } : item)),
  };
}

// Checks the whole draft. Returns { ok, values, errors }: values is what to save, and errors
// maps a field (or "ingredient:<key>") to a translation key.
export function validateRecipe(draft, units = 'metric') {
  const errors = {};
  const values = {
    id: draft.id ?? null,
    name: String(draft.name ?? '').trim(),
    starred: Boolean(draft.starred),
    servings: null,
    cookedWeightG: null,
    notes: String(draft.notes ?? '').trim() || null,
    mealTimeIds: uniqueIds(draft.mealTimeIds),
    ingredients: [],
  };

  if (values.name === '') errors.name = 'recipes.errors.nameRequired';
  else if (values.name.length > NAME_MAX) errors.name = 'recipes.errors.nameTooLong';

  const servings = parseAmount(draft.servings);
  if (!servings.ok) errors.servings = servings.error;
  else if (servings.value === null) errors.servings = 'recipes.errors.servingsRequired';
  else if (servings.value > SERVINGS_MAX) errors.servings = 'recipes.errors.tooLarge';
  else values.servings = servings.value;

  const cooked = parseGramsField(draft.cookedWeight, units, draft.storedCookedWeight);
  if (!cooked.ok) errors.cookedWeight = cooked.error;
  else if (cooked.value !== null && cooked.value > GRAMS_MAX)
    errors.cookedWeight = 'recipes.errors.tooLarge';
  else values.cookedWeightG = cooked.value;

  if (values.notes !== null && values.notes.length > NOTES_MAX)
    errors.notes = 'recipes.errors.notesTooLong';

  if (draft.ingredients.length === 0) errors.ingredients = 'recipes.errors.noIngredients';
  for (const item of draft.ingredients) {
    const grams = parseGramsField(item.grams, units, item.storedGrams);
    if (!item.food?.id) {
      errors[`ingredient:${item.key}`] = 'recipes.errors.noFood';
    } else if (!grams.ok) {
      errors[`ingredient:${item.key}`] = grams.error;
    } else if (grams.value === null) {
      errors[`ingredient:${item.key}`] = 'recipes.errors.gramsRequired';
    } else if (grams.value > GRAMS_MAX) {
      errors[`ingredient:${item.key}`] = 'recipes.errors.tooLarge';
    } else {
      values.ingredients.push({ foodId: item.food.id, grams: grams.value });
    }
  }

  return { ok: Object.keys(errors).length === 0, values, errors };
}

// The ingredients of a draft as { grams, food } for recipeTotals, skipping lines whose
// grams are not a usable number yet, so the preview updates as the Member types.
export function previewIngredients(draft, units = 'metric') {
  return draft.ingredients
    .map((item) => {
      const grams = parseGramsField(item.grams, units, item.storedGrams);
      return grams.ok && grams.value !== null && item.food
        ? { grams: grams.value, food: item.food }
        : null;
    })
    .filter(Boolean);
}

// Turns a loaded row (with nested ingredients and foods) into the shape the screens use.
function mapRecipe(row) {
  const ingredients = (row.recipe_ingredients ?? [])
    .slice()
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id)
    .map((item) => ({
      id: item.id,
      grams: Number(item.grams),
      food: item.foods,
    }));
  // A tag whose Meal Time the caller cannot read (another Member's) comes back with no
  // name; the screens say so and keep the tag when the Recipe is saved.
  const mealTimeTags = (row.recipe_meal_time_tags ?? [])
    .filter((tag) => tag.meal_time_id != null)
    .map((tag) => ({ id: tag.meal_time_id, name: tag.meal_times?.name ?? null }))
    .sort((a, b) => a.id - b.id);
  return {
    id: row.id,
    name: row.name,
    starred: row.starred,
    servings: Number(row.servings),
    cooked_weight_g: row.cooked_weight_g == null ? null : Number(row.cooked_weight_g),
    notes: row.notes,
    copied_from: row.copied_from ?? null,
    meal_time_tags: mealTimeTags,
    ingredients,
  };
}

// Every Recipe in the Household, starred first, then by name.
export async function loadRecipes(client) {
  const { data, error } = await client
    .from('recipes')
    .select(
      `${RECIPE_COLUMNS}, recipe_ingredients(id, grams, sort, foods(${FOOD_COLUMNS})), ` +
        `recipe_meal_time_tags(meal_time_id, meal_times(${MEAL_TIME_COLUMNS}))`
    )
    .order('starred', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapRecipe);
}

// The Meal Times the caller can read, to tag a Recipe with. Row-level security (migration
// 007, and 013 once Meal Times are shared) decides which ones; the list is a hint picker.
export async function loadMealTimeOptions(client) {
  const { data, error } = await client
    .from('meal_times')
    .select('id, name, time_of_day')
    .order('time_of_day', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({ id: row.id, name: row.name }));
}

// Foods from the Food Library whose name matches the text. The % and _ wildcards and the
// backslash are escaped so the text is matched literally.
export async function searchFoods(client, text) {
  const query = String(text ?? '').trim();
  if (query === '') return [];
  const pattern = query.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  const { data, error } = await client
    .from('foods')
    .select(FOOD_COLUMNS)
    .ilike('name', `%${pattern}%`)
    .order('name', { ascending: true })
    .limit(15);
  if (error) throw error;
  return data || [];
}

// Saves a validated draft (validateRecipe's values). Inserts the Recipe or updates the
// one with values.id, then replaces its ingredient lines. Not one transaction: if a later
// write fails, the error is thrown and the Recipe may need editing again.
export async function saveRecipe(client, values) {
  const row = {
    name: values.name,
    starred: values.starred,
    servings: values.servings,
    cooked_weight_g: values.cookedWeightG,
    notes: values.notes,
  };

  let recipeId = values.id;
  if (recipeId) {
    const { error } = await client.from('recipes').update(row).eq('id', recipeId);
    if (error) throw error;
  } else {
    const { data, error } = await client.from('recipes').insert(row).select('id').single();
    if (error) throw error;
    recipeId = data.id;
  }

  const { error: clearError } = await client
    .from('recipe_ingredients')
    .delete()
    .eq('recipe_id', recipeId);
  if (clearError) throw clearError;

  if (values.ingredients.length > 0) {
    const lines = values.ingredients.map((item, index) => ({
      recipe_id: recipeId,
      food_id: item.foodId,
      grams: item.grams,
      sort: index,
    }));
    const { error } = await client.from('recipe_ingredients').insert(lines);
    if (error) throw error;
  }

  // The tags are replaced as a set: clear the old ones, then insert the ticked ones.
  const { error: clearTagsError } = await client
    .from('recipe_meal_time_tags')
    .delete()
    .eq('recipe_id', recipeId);
  if (clearTagsError) throw clearTagsError;

  const tagIds = values.mealTimeIds ?? [];
  if (tagIds.length > 0) {
    const tags = tagIds.map((mealTimeId) => ({ recipe_id: recipeId, meal_time_id: mealTimeId }));
    const { error } = await client.from('recipe_meal_time_tags').insert(tags);
    if (error) throw error;
  }

  return recipeId;
}

// Copies a saved Recipe as a variation (migration 016 does it in one call, under the
// caller's row-level security). Returns the new Recipe's id.
export async function copyRecipe(client, id, name) {
  const { data, error } = await client.rpc('recipe_copy', { p_recipe_id: id, p_name: name });
  if (error) throw error;
  return data;
}

export async function deleteRecipe(client, id) {
  const { error } = await client.from('recipes').delete().eq('id', id);
  if (error) throw error;
}
