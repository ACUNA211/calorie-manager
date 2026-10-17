// Typed-in Nutrition Facts labels (ticket 20). The Member types the values printed per
// serving; this file checks them, converts them to per 100 g and builds the call that saves
// the food to the Food Library with its barcode. Pure except saveLabelFood, which takes the
// Supabase client as its first argument so tests can pass a fake.
//
// Every stored number is per 100 g, as the rest of the Food Library. A blank optional
// value (fibre, sugars, sodium) is null, never 0.

import { gtinForms, isValidGtin } from './gtin.js';

export const SAVE_LABEL_FUNCTION = 'save_label_food';

// Sane ranges for what a label prints per serving. Outside them, the form asks for a fix.
export const LABEL_LIMITS = {
  servingGrams: { min: 1, max: 5000 },
  kcal: { min: 0, max: 2000 },
  gramsPerServing: { min: 0, max: 500 },
  sodiumMgPerServing: { min: 0, max: 10000 },
};

// Calories are checked against 4·carbs + 4·protein + 9·fat (per serving). A label may be
// off by rounding and by fibre, so the check allows the larger of 10 kcal and 20 %.
export const ENERGY_TOLERANCE_KCAL = 10;
export const ENERGY_TOLERANCE_RATIO = 0.2;

export const LABEL_FIELDS = [
  'name',
  'brand',
  'servingGrams',
  'kcal',
  'protein',
  'carbs',
  'fat',
  'fibre',
  'sugars',
  'sodium',
];
export const REQUIRED_FIELDS = ['name', 'servingGrams', 'kcal', 'protein', 'carbs', 'fat'];
const MACRO_FIELDS = ['protein', 'carbs', 'fat', 'fibre', 'sugars'];

const round1 = (value) => Math.round(value * 10) / 10;

// A per-serving value as per 100 g, to one decimal.
export function toPer100g(perServing, servingGrams) {
  return round1((perServing * 100) / servingGrams);
}

// Calories that the macros should add up to (per serving): 4·carbs + 4·protein + 9·fat.
export function energyFromMacros({ protein, carbs, fat }) {
  return 4 * carbs + 4 * protein + 9 * fat;
}

// The energy check for one serving. Returns null when it cannot be made (a macro is
// missing), otherwise { expected, tolerance, ok }.
export function energyCheck({ kcal, protein, carbs, fat }) {
  if ([kcal, protein, carbs, fat].some((value) => value === null || value === undefined)) {
    return null;
  }
  const expected = energyFromMacros({ protein, carbs, fat });
  const tolerance = Math.max(ENERGY_TOLERANCE_KCAL, ENERGY_TOLERANCE_RATIO * expected);
  return { expected: round1(expected), tolerance, ok: Math.abs(kcal - expected) <= tolerance };
}

// Reads one typed amount. '' is blank (null); a comma is accepted as the decimal mark.
// Returns NaN for anything that is not a plain non-negative number.
export function parseAmount(text) {
  const trimmed = String(text ?? '').trim();
  if (trimmed === '') return null;
  const normal = trimmed.replace(',', '.');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(normal)) return Number.NaN;
  return Number(normal);
}

const inRange = (value, { min, max }) => value >= min && value <= max;

// Checks the typed form (strings, as the inputs hold them). Returns
//   { ok: true, food } where food has name, brand, servingGrams, perServing (the typed
//     values), per100g (converted) and energyWarning (the energyCheck result when it fails,
//     else null), or
//   { ok: false, errors } where errors maps a field name to a message key.
export function parseLabelForm(form) {
  const errors = {};
  const values = {};
  for (const field of LABEL_FIELDS) {
    const raw = form[field];
    if (field === 'name' || field === 'brand') {
      values[field] = String(raw ?? '').trim();
    } else {
      values[field] = parseAmount(raw);
    }
  }

  if (values.name === '') errors.name = 'required';
  for (const field of REQUIRED_FIELDS) {
    if (field === 'name') continue;
    if (values[field] === null) errors[field] = 'required';
  }
  for (const field of LABEL_FIELDS) {
    if (field === 'name' || field === 'brand') continue;
    if (values[field] !== null && Number.isNaN(values[field])) errors[field] = 'number';
  }
  if (!errors.name && values.name.length > 200) errors.name = 'tooLong';

  if (!errors.servingGrams && values.servingGrams !== null) {
    if (!inRange(values.servingGrams, LABEL_LIMITS.servingGrams)) {
      errors.servingGrams = 'range';
    }
  }
  if (!errors.kcal && values.kcal !== null && !inRange(values.kcal, LABEL_LIMITS.kcal)) {
    errors.kcal = 'range';
  }
  for (const field of MACRO_FIELDS) {
    const value = values[field];
    if (errors[field] || value === null) continue;
    if (!inRange(value, LABEL_LIMITS.gramsPerServing)) errors[field] = 'range';
    else if (!errors.servingGrams && value > values.servingGrams) {
      errors[field] = 'overServing';
    }
  }
  if (values.sodium !== null && !errors.sodium && !Number.isNaN(values.sodium)) {
    if (!inRange(values.sodium, LABEL_LIMITS.sodiumMgPerServing)) errors.sodium = 'range';
  }
  if (
    values.sugars !== null &&
    values.carbs !== null &&
    !errors.sugars &&
    !errors.carbs &&
    values.sugars > values.carbs
  ) {
    errors.sugars = 'sugarsOverCarbs';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const perServing = {
    kcal: values.kcal,
    protein: values.protein,
    carbs: values.carbs,
    fat: values.fat,
    fibre: values.fibre,
    sugars: values.sugars,
    sodium: values.sodium,
  };
  const grams = values.servingGrams;
  const convert = (value) => (value === null ? null : toPer100g(value, grams));
  const per100g = {
    kcal: convert(perServing.kcal),
    protein: convert(perServing.protein),
    carbs: convert(perServing.carbs),
    fat: convert(perServing.fat),
    fibre: convert(perServing.fibre),
    sugars: convert(perServing.sugars),
    sodium: convert(perServing.sodium),
  };
  const check = energyCheck(perServing);
  return {
    ok: true,
    food: {
      name: values.name,
      brand: values.brand === '' ? null : values.brand,
      servingGrams: grams,
      perServing,
      per100g,
      energyWarning: check && !check.ok ? check : null,
    },
  };
}

// The arguments of save_label_food (migration 028): the 14-digit barcode form and the
// per-100 g values. The database checks them again.
export function labelFoodPayload(code, food) {
  const [, , fourteen] = gtinForms(code);
  return {
    p_gtin: fourteen,
    p_name: food.name,
    p_brand: food.brand,
    p_serving_grams: food.servingGrams,
    p_kcal_per_100g: food.per100g.kcal,
    p_protein_g: food.per100g.protein,
    p_carbs_g: food.per100g.carbs,
    p_fat_g: food.per100g.fat,
    p_fibre_g: food.per100g.fibre,
    p_sugars_g: food.per100g.sugars,
    p_sodium_mg: food.per100g.sodium,
  };
}

// Saves a typed label food to the caller's Household with the scanned barcode. Returns the
// Food Library id. Throws when the barcode is not valid or the call fails.
export async function saveLabelFood(client, code, food) {
  if (!isValidGtin(code)) throw new Error('The barcode is not valid');
  const { data, error } = await client.rpc(SAVE_LABEL_FUNCTION, labelFoodPayload(code, food));
  if (error) throw error;
  return data;
}
