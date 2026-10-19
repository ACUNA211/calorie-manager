// The Intake form's formula (ticket #64), from ticket 01's research
// (.scratch/restart/research/targets-formula.md). Pure: no network, no screen text. Everything
// is metric (kg, cm); the screen converts the Member's display units before calling it.
//
//   1. RMR  = Mifflin-St Jeor: 10 x kg + 6.25 x cm - 5 x age + 5 (men) or - 161 (women)
//   2. TDEE = RMR x activity factor (1.2, 1.375, 1.55, 1.725), from work and planned exercise
//   3. Calorie Target = TDEE - deficit (0 to maintain, else 250, 500 or 750), then clamped
//      at the Member's suggestion floor (ticket #70). No warning when it clamps.
//   4. Protein floor = 1.4 g per kg; fat 25-35% and carbs 45-65% of the Calorie Target.
// The activity factors are the conventional values; the research marks them as not checked
// against a primary source.

export const SEXES = ['female', 'male'];
export const WORKS = ['sitting', 'on_feet', 'heavy'];
export const GOALS = ['lose', 'maintain', 'hand'];
export const PACES = [250, 500, 750];
export const DEFAULT_PACE = 500;
export const ADULT_AGE = 18;

export const ACTIVITY_FACTORS = [1.2, 1.375, 1.55, 1.725];
export const PROTEIN_G_PER_KG = 1.4;
export const FAT_SHARE = { low: 0.25, high: 0.35 };
export const CARB_SHARE = { low: 0.45, high: 0.65 };
export const KCAL_PER_G = { protein: 4, carb: 4, fat: 9 };
export const DEFAULT_FLOOR_KCAL = { female: 1200, male: 1500 };

const WORK_LEVEL = { sitting: 0, on_feet: 1, heavy: 2 };

// Whole years between a birth date ('2000-05-17') and today ('2026-10-19'). Null if either
// is not a real date, or the birth date is after today.
export function ageOn(birthDate, todayKey) {
  const parse = (text) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text ?? ''));
    if (!match) return null;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1) return null;
    if (date.getUTCDate() !== day) return null;
    return { year, month, day };
  };
  const birth = parse(birthDate);
  const today = parse(todayKey);
  if (!birth || !today) return null;
  let age = today.year - birth.year;
  if (today.month < birth.month || (today.month === birth.month && today.day < birth.day)) age -= 1;
  return age < 0 ? null : age;
}

// Resting energy, kcal per day (not rounded).
export function mifflinStJeor({ sex, kg, cm, age }) {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'male' ? 5 : -161);
}

// The activity factor from the work and the planned exercise. Work gives the starting level
// (sitting 0, on your feet 1, heavy 2); exercise adds one level from 90 minutes a week and
// two from 300. The level stops at 3. Unknown or missing answers count as the lowest.
export function activityFactor({ work, sessions, minutes }) {
  const base = WORK_LEVEL[work] ?? 0;
  const weekly = Math.max(0, Number(sessions) || 0) * Math.max(0, Number(minutes) || 0);
  const bump = weekly >= 300 ? 2 : weekly >= 90 ? 1 : 0;
  return ACTIVITY_FACTORS[Math.min(3, base + bump)];
}

// The floor in kcal that applies, or null when the Member turned it off.
export function floorFor({ sex, floorOn = true, floorKcal = null }) {
  if (!floorOn) return null;
  if (Number.isInteger(floorKcal) && floorKcal > 0) return floorKcal;
  return DEFAULT_FLOOR_KCAL[sex === 'male' ? 'male' : 'female'];
}

// The suggestion. Returns { ok: true, ... } or { ok: false, reason } where reason is one of
// 'dependent', 'underage', 'pregnant', 'hand', 'missing'. A Dependent, an under-18, a pregnant
// or breastfeeding Member, and the "hand-enter" goal get no suggestion.
export function suggestTargets(input) {
  const { isDependent = false, age, pregnant = false, goal, pace = DEFAULT_PACE } = input;
  if (isDependent) return { ok: false, reason: 'dependent' };
  if (age !== null && age !== undefined && age < ADULT_AGE) {
    return { ok: false, reason: 'underage' };
  }
  if (pregnant) return { ok: false, reason: 'pregnant' };
  if (goal === 'hand') return { ok: false, reason: 'hand' };
  const { sex, kg, cm } = input;
  if (!SEXES.includes(sex) || !(kg > 0) || !(cm > 0) || age === null || age === undefined) {
    return { ok: false, reason: 'missing' };
  }
  if (!GOALS.includes(goal)) return { ok: false, reason: 'missing' };

  const rmr = mifflinStJeor({ sex, kg, cm, age });
  const factor = activityFactor(input);
  const tdee = rmr * factor;
  const deficit = goal === 'lose' ? (PACES.includes(pace) ? pace : DEFAULT_PACE) : 0;
  const raw = Math.round(tdee - deficit);
  const floor = floorFor(input);
  const clamped = floor !== null && raw < floor;
  const calories = clamped ? floor : raw;

  return {
    ok: true,
    rmr: Math.round(rmr),
    factor,
    tdee: Math.round(tdee),
    deficit,
    floor,
    clamped,
    calorieTarget: calories,
    proteinFloorG: Math.round(PROTEIN_G_PER_KG * kg),
    fatLowG: Math.round((calories * FAT_SHARE.low) / KCAL_PER_G.fat),
    fatHighG: Math.round((calories * FAT_SHARE.high) / KCAL_PER_G.fat),
    carbLowG: Math.round((calories * CARB_SHARE.low) / KCAL_PER_G.carb),
    carbHighG: Math.round((calories * CARB_SHARE.high) / KCAL_PER_G.carb),
  };
}

// Reads the height field(s). Metric: centimetres. US: feet and inches. Returns
// { ok: true, cm } (one decimal) or { ok: false, error } with a translation key.
export function parseHeight(units, fields) {
  const number = (text) => {
    const trimmed = String(text ?? '')
      .trim()
      .replace(',', '.');
    return /^\d{1,3}(\.\d)?$/.test(trimmed) ? Number(trimmed) : null;
  };
  let cm;
  if (units === 'metric') {
    cm = number(fields.cm);
  } else {
    const feet = number(fields.feet);
    const inches = String(fields.inches ?? '').trim() === '' ? 0 : number(fields.inches);
    cm = feet === null || inches === null ? null : (feet * 12 + inches) * 2.54;
  }
  if (cm === null) return { ok: false, error: 'intake.errors.heightNumber' };
  cm = Math.round(cm * 10) / 10;
  if (cm < 50 || cm > 260) return { ok: false, error: 'intake.errors.heightRange' };
  return { ok: true, cm };
}

// Height text for the fields from a stored value, in the display units.
export function heightFields(cm, units) {
  if (cm === null || cm === undefined || cm === '') return { cm: '', feet: '', inches: '' };
  const value = Number(cm);
  if (units === 'metric') return { cm: String(Math.round(value * 10) / 10), feet: '', inches: '' };
  const totalInches = Math.round(value / 2.54);
  return { cm: '', feet: String(Math.floor(totalInches / 12)), inches: String(totalInches % 12) };
}

// Reads a whole number in a range from a text field. Empty gives { ok: true, value: null }.
export function parseCount(text, min, max, errorKey) {
  const trimmed = String(text ?? '').trim();
  if (trimmed === '') return { ok: true, value: null };
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: errorKey };
  const value = Number(trimmed);
  if (value < min || value > max) return { ok: false, error: errorKey };
  return { ok: true, value };
}
