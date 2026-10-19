// Targets for one Member, stored in member_settings. The validation functions are pure:
// they return translation keys, not text, so the screen shows them through t().
// Data access takes the Supabase client as its first argument so tests can pass a fake.
// The protein floor and the carb and fat ranges are grams stored as whole numbers, and the form
// shows and reads them in grams whatever the Member's display units (ticket 93).

export const TARGET_COLUMNS =
  'calorie_target, protein_floor_g, carb_low_g, carb_high_g, fat_low_g, fat_high_g, band_low_pct, band_high_pct';

export const DEFAULT_BAND = { low: 90, high: 100 };
export const MAX_GRAMS = 100000;

// Form fields are strings, so an empty field can mean "cleared".
export function emptyForm() {
  return {
    calorieTarget: '',
    proteinFloor: '',
    carbLow: '',
    carbHigh: '',
    fatLow: '',
    fatHigh: '',
    bandLow: String(DEFAULT_BAND.low),
    bandHigh: String(DEFAULT_BAND.high),
  };
}

const orEmpty = (value) => (value === null || value === undefined ? '' : String(value));

// A stored row (or none, for a Member with no settings row yet) becomes form strings.
export function rowToForm(row) {
  if (!row) return emptyForm();
  return {
    calorieTarget: orEmpty(row.calorie_target),
    proteinFloor: orEmpty(row.protein_floor_g),
    carbLow: orEmpty(row.carb_low_g),
    carbHigh: orEmpty(row.carb_high_g),
    fatLow: orEmpty(row.fat_low_g),
    fatHigh: orEmpty(row.fat_high_g),
    bandLow: orEmpty(row.band_low_pct ?? DEFAULT_BAND.low),
    bandHigh: orEmpty(row.band_high_pct ?? DEFAULT_BAND.high),
  };
}

// Reads a whole number from a field. Empty gives null (cleared). Anything else that is
// not an optional minus sign and digits is an error, so "1.5" or "2,000" is refused.
export function parseWhole(text) {
  const trimmed = String(text ?? '').trim();
  if (trimmed === '') return { ok: true, value: null };
  if (!/^-?\d+$/.test(trimmed)) return { ok: false, error: 'targets.errors.whole' };
  return { ok: true, value: Number(trimmed) };
}

// A gram Target typed as a whole number of grams. Empty is null (cleared).
export const parseGramTarget = parseWhole;

// Checks one gram Target against a minimum and the maximum grams allowed.
function checkGrams(text, min, minError) {
  const parsed = parseGramTarget(text);
  if (!parsed.ok) return parsed;
  if (parsed.value === null) return parsed;
  if (parsed.value < min) return { ok: false, error: minError };
  if (parsed.value > MAX_GRAMS) return { ok: false, error: 'targets.errors.tooLarge' };
  return parsed;
}

// Checks one whole-number field against a minimum and the maximum allowed.
function checkWhole(text, min, minError) {
  const parsed = parseWhole(text);
  if (!parsed.ok) return parsed;
  if (parsed.value === null) return parsed;
  if (parsed.value < min) return { ok: false, error: minError };
  if (parsed.value > MAX_GRAMS) return { ok: false, error: 'targets.errors.tooLarge' };
  return parsed;
}

// Validates the whole form. Returns { ok, values, errors }. values holds the columns to
// save (null for a cleared Target). errors maps a form field to a translation key.
export function validateTargets(form) {
  const errors = {};
  const values = {};

  const put = (field, column, result) => {
    if (!result.ok) errors[field] = result.error;
    values[column] = result.ok ? result.value : null;
  };

  put(
    'calorieTarget',
    'calorie_target',
    checkWhole(form.calorieTarget, 1, 'targets.errors.calorieTargetPositive')
  );
  put(
    'proteinFloor',
    'protein_floor_g',
    checkGrams(form.proteinFloor, 0, 'targets.errors.notNegative')
  );

  // Carb and fat ranges are both empty or both filled, with low at or below high.
  const range = (lowField, highField, lowColumn, highColumn) => {
    const low = checkGrams(form[lowField], 0, 'targets.errors.notNegative');
    const high = checkGrams(form[highField], 0, 'targets.errors.notNegative');
    put(lowField, lowColumn, low);
    put(highField, highColumn, high);
    if (!low.ok || !high.ok) return;
    const lowEmpty = low.value === null;
    const highEmpty = high.value === null;
    if (lowEmpty !== highEmpty) {
      const missing = lowEmpty ? lowField : highField;
      errors[missing] = 'targets.errors.rangeIncomplete';
      return;
    }
    if (!lowEmpty && low.value > high.value) {
      errors[highField] = 'targets.errors.rangeOrder';
    }
  };
  range('carbLow', 'carbHigh', 'carb_low_g', 'carb_high_g');
  range('fatLow', 'fatHigh', 'fat_low_g', 'fat_high_g');

  // The Planning band is always set: a percent from 50 to 100, low at or below high.
  const bandLow = parseWhole(form.bandLow);
  const bandHigh = parseWhole(form.bandHigh);
  const bandPercent = (result) => {
    if (!result.ok) return result;
    if (result.value === null || result.value < 50 || result.value > 100) {
      return { ok: false, error: 'targets.errors.bandRange' };
    }
    return result;
  };
  put('bandLow', 'band_low_pct', bandPercent(bandLow));
  put('bandHigh', 'band_high_pct', bandPercent(bandHigh));
  if (!errors.bandLow && !errors.bandHigh && values.band_low_pct > values.band_high_pct) {
    errors.bandHigh = 'targets.errors.bandOrder';
  }

  return { ok: Object.keys(errors).length === 0, values, errors };
}

// The Planning band in calories: a percent of the Calorie Target, rounded to whole kcal.
export function bandCalories(calorieTarget, lowPct, highPct) {
  return {
    low: Math.round((calorieTarget * lowPct) / 100),
    high: Math.round((calorieTarget * highPct) / 100),
  };
}

// The Member the signed-in person is, when no memberId is given. Null if they have none.
export async function resolveMemberId(client, userId) {
  const { data, error } = await client
    .from('members')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? data.id : null;
}

// The Member's Targets as a row, or null when no settings row exists yet.
export async function loadTargets(client, memberId) {
  const { data, error } = await client
    .from('member_settings')
    .select(TARGET_COLUMNS)
    .eq('member_id', memberId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Saves the validated values. Upsert, so a Member with no settings row still gets one.
export async function saveTargets(client, memberId, values) {
  const { error } = await client
    .from('member_settings')
    .upsert(
      { member_id: memberId, ...values, updated_at: new Date().toISOString() },
      { onConflict: 'member_id' }
    );
  if (error) throw error;
}
