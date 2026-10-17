// Open Food Facts results for Scan (ticket 19). The off-lookup Edge Function does the call
// (rate limit, User-Agent, storing the product unmodified in off_products). This file turns
// a stored product into a search-style result and asks the function. Nothing here calls
// Open Food Facts directly. Data: Open Food Facts, ODbL (see OffCredit.jsx for the credit).
//
// Every number is per 100 g. A missing value is null, never 0.

export const OFF_FUNCTION = 'off-lookup';
export const OFF_HOME_URL = 'https://world.openfoodfacts.org/';

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

// kcal per 100 g: the kcal value when Open Food Facts gives one, else kJ divided by 4.184.
function kcalPer100g(nutriments) {
  const kcal = numberOrNull(nutriments['energy-kcal_100g']);
  if (kcal !== null) return kcal;
  const kj = numberOrNull(nutriments.energy_100g);
  return kj === null ? null : Math.round((kj / 4.184) * 10) / 10;
}

// The serving, when it is weighed or measured in grams or millilitres (1 ml counted as 1 g,
// as the app does for USDA servings). Anything else gives no serving.
function servingOf(product) {
  const grams = numberOrNull(product.serving_quantity);
  const unit = String(product.serving_quantity_unit ?? 'g').toLowerCase();
  if (grams === null || grams <= 0 || !['g', 'ml'].includes(unit)) {
    return { servingGrams: null, servingLabel: null };
  }
  return {
    servingGrams: grams,
    servingLabel: product.serving_size ? String(product.serving_size) : null,
  };
}

// A stored Open Food Facts product (the product object as returned, barcode and offCode
// alongside) becomes a result with the same shape as a Food Library or USDA result, plus
// the barcode and source 'off'. Macros are null where Open Food Facts gives no value.
export function offResult({ barcode, product }) {
  const nutriments =
    product.nutriments && typeof product.nutriments === 'object' ? product.nutriments : {};
  const sodiumG = numberOrNull(nutriments.sodium_100g);
  const macros = {
    protein: numberOrNull(nutriments.proteins_100g),
    carbs: numberOrNull(nutriments.carbohydrates_100g),
    fat: numberOrNull(nutriments.fat_100g),
    fibre: numberOrNull(nutriments.fiber_100g),
    sugars: numberOrNull(nutriments.sugars_100g),
    sodium: sodiumG === null ? null : Math.round(sodiumG * 1000 * 10) / 10,
  };
  const brand = product.brands ? String(product.brands).split(',')[0].trim() || null : null;
  const name =
    [product.product_name_en, product.product_name, product.generic_name]
      .map((value) => (value ? String(value).trim() : ''))
      .find((value) => value !== '') || `Barcode ${barcode}`;
  return {
    key: `off:${barcode}`,
    source: 'off',
    id: null,
    usdaId: null,
    offBarcode: barcode,
    name,
    nameEs: null,
    nameEsEdited: false,
    brand,
    kcalPer100g: kcalPer100g(nutriments),
    macros,
    ...servingOf(product),
  };
}

// Asks the Edge Function for a barcode. Returns { status: 'found', result } (a result as
// offResult gives), { status: 'notFound' }, or { status: 'notFound', offStatus } where
// offStatus is 'rateLimited' or 'unavailable' (the answer is "try again", not "no food").
// Throws when the call itself fails (no connection, server error).
export async function lookupOff(client, barcode) {
  const { data, error } = await client.functions.invoke(OFF_FUNCTION, {
    body: { code: barcode },
  });
  if (error) throw error;
  if (data?.status === 'found' && data.product) {
    return {
      status: 'found',
      result: offResult({ barcode: String(data.barcode), product: data.product }),
    };
  }
  if (data?.status === 'notFound' || data?.status === 'invalid') return { status: 'notFound' };
  if (data?.status === 'rateLimited') return { status: 'notFound', offStatus: 'rateLimited' };
  return { status: 'notFound', offStatus: 'unavailable' };
}
