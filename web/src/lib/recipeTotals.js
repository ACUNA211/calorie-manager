// Recipe totals. Pure functions, no data access.
//
// A Recipe's calories and macros come from its ingredients: each ingredient is grams of a
// Food Library food, and the food's values are per 100 g. The totals are then shared out
// per serving. A macro total is null when any ingredient's food has no value for it, so
// the screen shows "unknown" rather than a low number. A Recipe with no ingredients totals 0.
//
// Food values use the column names of the foods table (kcal_per_100g, protein_g, ...).

// The macros shown per serving, with the foods column each one reads from.
export const MACRO_COLUMNS = {
  protein: 'protein_g',
  carbs: 'carbs_g',
  fat: 'fat_g',
  fibre: 'fibre_g',
  sugars: 'sugars_g',
  sodium: 'sodium_mg',
};

export const MACRO_KEYS = Object.keys(MACRO_COLUMNS);

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

// Sums one nutrient over the ingredients: sum(grams * value / 100).
// Returns null when any food is missing the value; 0 for an empty list.
export function nutrientTotal(ingredients, column) {
  let total = 0;
  for (const ingredient of ingredients) {
    const value = ingredient.food?.[column];
    if (!isNumber(value)) return null;
    total += (Number(ingredient.grams) * value) / 100;
  }
  return total;
}

// Divides a total by the servings. Null when the servings are not a positive number.
export function perServing(total, servings) {
  if (total === null || !isNumber(servings) || servings <= 0) return null;
  return total / servings;
}

// Grams in one serving, from the weighed cooked yield. Null when no weight is given or the
// servings are not positive: the cooked weight sets the serving size, the servings count
// still decides how many servings there are.
export function gramsPerServing(cookedWeightG, servings) {
  if (!isNumber(cookedWeightG) || cookedWeightG <= 0) return null;
  if (!isNumber(servings) || servings <= 0) return null;
  return cookedWeightG / servings;
}

// Totals for a Recipe: { servings, ingredients: [{ grams, food }] }.
// Returns the total weight of the ingredients, calories, each macro (total and per serving,
// or null when unknown), and per-serving values for calories.
export function recipeTotals(recipe) {
  const ingredients = recipe?.ingredients ?? [];
  const servings = recipe?.servings;

  const totalGrams = ingredients.reduce((sum, item) => sum + Number(item.grams || 0), 0);
  const kcalTotal = nutrientTotal(ingredients, 'kcal_per_100g');

  const macros = {};
  for (const [key, column] of Object.entries(MACRO_COLUMNS)) {
    const total = nutrientTotal(ingredients, column);
    macros[key] = total === null ? null : { total, perServing: perServing(total, servings) };
  }

  return {
    totalGrams,
    kcal: {
      total: kcalTotal,
      perServing: perServing(kcalTotal, servings),
    },
    macros,
  };
}
