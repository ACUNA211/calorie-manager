// Recipes: the editor's pure helpers (form strings in, values out) and the data access.
// Data functions take the Supabase client as their first argument so tests can pass a fake.
// The Household is applied by row-level security (migration 006): the household_id column
// defaults to the caller's Household, so inserts do not set it.

export const NAME_MAX = 120;
export const NOTES_MAX = 2000;
export const GRAMS_MAX = 100000;
export const SERVINGS_MAX = 1000;

const RECIPE_COLUMNS = 'id, name, starred, servings, cooked_weight_g, notes, copied_from';
const FOOD_COLUMNS =
  'id, name, brand, kcal_per_100g, protein_g, carbs_g, fat_g, fibre_g, sugars_g, sodium_mg';

let keyCounter = 0;
// A key for React lists that stays put while an ingredient is edited.
export function nextKey() {
  keyCounter += 1;
  return `ingredient-${keyCounter}`;
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

export function emptyRecipeDraft() {
  return {
    id: null,
    name: '',
    starred: false,
    servings: '1',
    cookedWeight: '',
    notes: '',
    ingredients: [],
  };
}

// A stored Recipe (as loaded by loadRecipes) becomes an editor draft.
export function draftFromRecipe(recipe) {
  return {
    id: recipe.id,
    name: recipe.name,
    starred: Boolean(recipe.starred),
    servings: String(recipe.servings),
    cookedWeight: recipe.cooked_weight_g == null ? '' : String(recipe.cooked_weight_g),
    notes: recipe.notes ?? '',
    ingredients: (recipe.ingredients ?? []).map((item) => ({
      key: nextKey(),
      id: item.id,
      food: item.food,
      grams: String(item.grams),
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
export function validateRecipe(draft) {
  const errors = {};
  const values = {
    id: draft.id ?? null,
    name: String(draft.name ?? '').trim(),
    starred: Boolean(draft.starred),
    servings: null,
    cookedWeightG: null,
    notes: String(draft.notes ?? '').trim() || null,
    ingredients: [],
  };

  if (values.name === '') errors.name = 'recipes.errors.nameRequired';
  else if (values.name.length > NAME_MAX) errors.name = 'recipes.errors.nameTooLong';

  const servings = parseAmount(draft.servings);
  if (!servings.ok) errors.servings = servings.error;
  else if (servings.value === null) errors.servings = 'recipes.errors.servingsRequired';
  else if (servings.value > SERVINGS_MAX) errors.servings = 'recipes.errors.tooLarge';
  else values.servings = servings.value;

  const cooked = parseAmount(draft.cookedWeight);
  if (!cooked.ok) errors.cookedWeight = cooked.error;
  else if (cooked.value !== null && cooked.value > GRAMS_MAX)
    errors.cookedWeight = 'recipes.errors.tooLarge';
  else values.cookedWeightG = cooked.value;

  if (values.notes !== null && values.notes.length > NOTES_MAX)
    errors.notes = 'recipes.errors.notesTooLong';

  if (draft.ingredients.length === 0) errors.ingredients = 'recipes.errors.noIngredients';
  for (const item of draft.ingredients) {
    const grams = parseAmount(item.grams);
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
export function previewIngredients(draft) {
  return draft.ingredients
    .map((item) => {
      const grams = parseAmount(item.grams);
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
  return {
    id: row.id,
    name: row.name,
    starred: row.starred,
    servings: Number(row.servings),
    cooked_weight_g: row.cooked_weight_g == null ? null : Number(row.cooked_weight_g),
    notes: row.notes,
    ingredients,
  };
}

// Every Recipe in the Household, starred first, then by name.
export async function loadRecipes(client) {
  const { data, error } = await client
    .from('recipes')
    .select(`${RECIPE_COLUMNS}, recipe_ingredients(id, grams, sort, foods(${FOOD_COLUMNS}))`)
    .order('starred', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapRecipe);
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

  return recipeId;
}

export async function deleteRecipe(client, id) {
  const { error } = await client.from('recipes').delete().eq('id', id);
  if (error) throw error;
}
