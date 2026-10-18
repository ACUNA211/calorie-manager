// Pure rules for the Meal Times page: validation, day totals and overlap detection.
// No React and no Supabase here, so every rule is tested directly.
// Validation returns translation keys (under mealTimes.errors.*); the page calls t().

export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]; // 0 = Sunday
export const KINDS = ['set', 'planned', 'if_room'];

// Stored times come back as "07:30:00"; the page works in "07:30".
export function normalizeTime(value) {
  return String(value || '').slice(0, 5);
}

export function minutesOf(time) {
  const [hours, minutes] = normalizeTime(time).split(':').map(Number);
  return hours * 60 + minutes;
}

const isWholeNumber = (value) => /^\d+$/.test(String(value ?? '').trim());

// A draft is what the editor holds: calories as typed strings.
// Returns { errors } where errors maps a field to a translation key; empty when valid.
export function validateMealTime(draft) {
  const errors = {};
  if (!String(draft.name ?? '').trim()) errors.name = 'mealTimes.errors.nameRequired';
  if (!/^\d{2}:\d{2}$/.test(normalizeTime(draft.time))) {
    errors.time = 'mealTimes.errors.timeRequired';
  }
  if (!KINDS.includes(draft.kind)) errors.kind = 'mealTimes.errors.kindRequired';

  if (draft.kind === 'set') {
    if (!isWholeNumber(draft.setCalories)) {
      errors.setCalories = 'mealTimes.errors.setCaloriesRequired';
    }
  } else if (KINDS.includes(draft.kind)) {
    if (!isWholeNumber(draft.calMin) || !isWholeNumber(draft.calMax)) {
      errors.range = 'mealTimes.errors.rangeRequired';
    } else if (Number(draft.calMin) > Number(draft.calMax)) {
      errors.range = 'mealTimes.errors.rangeOrder';
    }
  }
  return { errors };
}

// The database row for a valid draft. Only the fields that belong to the kind are filled.
export function draftToRow(draft) {
  const weekdays = [...new Set(draft.weekdays)].sort((a, b) => a - b);
  const base = {
    name: String(draft.name).trim(),
    time_of_day: normalizeTime(draft.time),
    kind: draft.kind,
    weekdays,
  };
  if (draft.kind === 'set') {
    return { ...base, set_calories: Number(draft.setCalories), cal_min: null, cal_max: null };
  }
  return {
    ...base,
    set_calories: null,
    cal_min: Number(draft.calMin),
    cal_max: Number(draft.calMax),
  };
}

// The Members who share a Meal Time: the creator and the Member editing it are always in.
// Returns sorted, unique numeric ids.
export function normalizeSharerIds(sharerIds, creatorId, editorId) {
  const ids = [...(sharerIds || []), creatorId, editorId].map(Number).filter((id) => id > 0);
  return [...new Set(ids)].sort((a, b) => a - b);
}

// True when the Member's own row lacks the number its kind needs: Set needs one number,
// Planned needs both ends of its range, If room needs its maximum (it only fills what is
// left). A kind change can leave a sharer's row like this.
export function needsCalories(meal) {
  if (meal.kind === 'set') return meal.set_calories == null;
  if (meal.kind === 'if_room') return meal.cal_max == null;
  return meal.cal_min == null || meal.cal_max == null;
}

// Other Meal Times that share a weekday with `meal` and start at the exact same time (decision #72).
// `weekdays` is the days being checked (a toggle checks one day; a save checks all of its days).
// Returns [{ meal: other, weekdays: [shared days] }].
export function findOverlaps(meal, allMeals, weekdays) {
  const clashes = [];
  for (const other of allMeals) {
    if (other.id === meal.id) continue;
    if (minutesOf(other.time_of_day) !== minutesOf(meal.time_of_day)) {
      continue;
    }
    const shared = weekdays.filter((day) => (other.weekdays || []).includes(day));
    if (shared.length > 0) clashes.push({ meal: other, weekdays: shared });
  }
  return clashes;
}

// The day's totals. Set counts in full; Planned counts its minimum in the floor and its
// maximum in the ceiling; If room counts only in the ceiling (it fills what is left).
// Status: 'over' when the floor already goes over the Target; 'short' when even the
// ceiling cannot reach the bottom of the aim; 'noTarget' without a Calorie Target; else 'ok'.
export function dayTotals(meals, weekday, targets) {
  let floor = 0;
  let ceiling = 0;
  for (const meal of meals) {
    if (!(meal.weekdays || []).includes(weekday)) continue;
    if (meal.kind === 'set') {
      floor += Number(meal.set_calories) || 0;
      ceiling += Number(meal.set_calories) || 0;
    } else if (meal.kind === 'planned') {
      floor += Number(meal.cal_min) || 0;
      ceiling += Number(meal.cal_max) || 0;
    } else if (meal.kind === 'if_room') {
      ceiling += Number(meal.cal_max) || 0;
    }
  }

  const target = Number(targets?.calorie_target) || 0;
  if (!target) {
    return { floor, ceiling, target: 0, aimLow: 0, aimHigh: 0, status: 'noTarget' };
  }

  const bandLow = Number(targets.band_low_pct);
  const bandHigh = Number(targets.band_high_pct);
  const aimLow = Math.round((target * bandLow) / 100);
  const aimHigh = Math.round((target * bandHigh) / 100);

  let status = 'ok';
  if (floor > target) status = 'over';
  else if (ceiling < aimLow) status = 'short';

  return { floor, ceiling, target, aimLow, aimHigh, status };
}

// Reads the Targets row, falling back to the database defaults (band 90 to 100) when missing.
export function targetsFromRow(row) {
  return {
    calorie_target: row?.calorie_target ?? null,
    band_low_pct: row?.band_low_pct ?? 90,
    band_high_pct: row?.band_high_pct ?? 100,
  };
}
