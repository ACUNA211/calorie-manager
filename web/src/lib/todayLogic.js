// Pure rules for the Today screen: date maths, the day's totals, the day bar, the Meal Time
// sections and the log form. No React and no Supabase here, so every rule is tested directly.
// Validation and status results return translation keys (under today.*); the screen calls t().
// The Planning band comes from targets.js and the Meal Time clock rules from mealTimesLogic.js.

import { scaleToGrams } from './foods.js';
import { bandCalories, DEFAULT_BAND } from './targets.js';
import { minutesOf } from './mealTimesLogic.js';

// Above this many grams one entry is refused, so a typo like 100000 cannot be logged.
export const MAX_LOG_GRAMS = 10000;

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

// ---- Dates -----------------------------------------------------------------------------

// A local calendar day as 'YYYY-MM-DD'. Built from local parts, never from toISOString(),
// which is UTC and would move the day for anyone east or west of Greenwich late at night.
export function dateKey(date) {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isDateKey(value) {
  return DATE_KEY.test(String(value ?? ''));
}

// A 'YYYY-MM-DD' key as a local Date at midnight. Throws on a malformed key.
export function parseDateKey(key) {
  const match = DATE_KEY.exec(String(key ?? ''));
  if (!match) throw new Error(`Not a date key: ${key}`);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

// The day `count` days after (or before, when negative) the key. Month and year ends roll over.
export function addDays(key, count) {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + count);
  return dateKey(date);
}

// 0 = Sunday, as in the Meal Time weekdays.
export function weekdayOf(key) {
  return parseDateKey(key).getDay();
}

// Keys are zero-padded, so comparing the strings compares the days.
export function isFutureDay(key, todayKey) {
  return key > todayKey;
}

// Whether a day can take new entries: today and the past, never the future.
export function canLogOn(key, todayKey) {
  return !isFutureDay(key, todayKey);
}

// The clock as minutes after midnight, and as 'HH:MM' for a logged time.
export function clockMinutes(date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function clockTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// ---- Targets ---------------------------------------------------------------------------

// The Targets fields the Today screen uses, with the Planning band defaulted (90 to 100)
// when the Member has no settings row yet.
export function targetView(row) {
  return {
    calorieTarget: row?.calorie_target ?? null,
    bandLowPct: row?.band_low_pct ?? DEFAULT_BAND.low,
    bandHighPct: row?.band_high_pct ?? DEFAULT_BAND.high,
    proteinFloor: row?.protein_floor_g ?? null,
    carbLow: row?.carb_low_g ?? null,
    carbHigh: row?.carb_high_g ?? null,
    fatLow: row?.fat_low_g ?? null,
    fatHigh: row?.fat_high_g ?? null,
  };
}

// ---- Meal Times ------------------------------------------------------------------------

// The Meal Times that apply on a weekday, in time order.
export function mealsOnDay(meals, weekday) {
  return (meals || [])
    .filter((meal) => (meal.weekdays || []).includes(weekday))
    .sort(
      (a, b) => minutesOf(a.time_of_day) - minutesOf(b.time_of_day) || Number(a.id) - Number(b.id)
    );
}

// The Meal Time on this weekday whose time is closest to the clock. A tie goes to the
// earlier one. Null when no Meal Time applies on that day.
export function nearestMealTime(meals, weekday, nowMinutes) {
  let best = null;
  let bestDistance = Infinity;
  for (const meal of mealsOnDay(meals, weekday)) {
    const distance = Math.abs(minutesOf(meal.time_of_day) - nowMinutes);
    if (distance < bestDistance) {
      best = meal;
      bestDistance = distance;
    }
  }
  return best;
}

// The Meal Time a new entry starts on: the nearest one now, or null (logged as another time).
export function defaultMealTimeId(meals, weekday, now) {
  const meal = nearestMealTime(meals, weekday, clockMinutes(now));
  return meal ? meal.id : null;
}

// The day's Meal Time sections. Each applicable Meal Time gets the entries logged to it,
// and entries at any other time (or at a Meal Time that no longer applies) go to `other`.
export function mealSections(meals, entries, weekday) {
  const dayMeals = mealsOnDay(meals, weekday);
  const ids = new Set(dayMeals.map((meal) => Number(meal.id)));
  const sections = dayMeals.map((meal) => {
    const own = entries.filter((entry) => Number(entry.meal_time_id) === Number(meal.id));
    return { meal, entries: own, kcal: sumKcal(own) };
  });
  const other = entries.filter(
    (entry) => entry.meal_time_id == null || !ids.has(Number(entry.meal_time_id))
  );
  return { sections, other: { entries: other, kcal: sumKcal(other) } };
}

// ---- Totals and the day bar ------------------------------------------------------------

const number = (value) => (value == null ? 0 : Number(value));
const oneDecimal = (value) => Math.round(value * 10) / 10;

function sumKcal(entries) {
  return oneDecimal(entries.reduce((total, entry) => total + number(entry.kcal), 0));
}

// The day's totals from the Calorie Log rows. A missing macro counts as nothing in the sum,
// and `missingMacros` says how many entries have one, so the screen can say so.
export function sumEntries(entries) {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, missingMacros: 0 };
  for (const entry of entries || []) {
    totals.kcal += number(entry.kcal);
    totals.protein += number(entry.protein_g);
    totals.carbs += number(entry.carbs_g);
    totals.fat += number(entry.fat_g);
    if (entry.protein_g == null || entry.carbs_g == null || entry.fat_g == null) {
      totals.missingMacros += 1;
    }
  }
  return {
    kcal: oneDecimal(totals.kcal),
    protein: oneDecimal(totals.protein),
    carbs: oneDecimal(totals.carbs),
    fat: oneDecimal(totals.fat),
    missingMacros: totals.missingMacros,
  };
}

// The calorie bar. Status, checked in this order: noTarget without a Calorie Target; over
// when eaten is past the Target; aboveBand when between the band's top and the Target;
// inBand when inside the band; under below the band. `left` is negative once over.
export function calorieBar(eaten, targets) {
  const target = targets.calorieTarget;
  if (!target) {
    return {
      status: 'noTarget',
      eaten,
      target: null,
      left: null,
      aimLow: null,
      aimHigh: null,
      fraction: 0,
    };
  }
  const band = bandCalories(target, targets.bandLowPct, targets.bandHighPct);
  let status;
  if (eaten > target) status = 'over';
  else if (eaten > band.high) status = 'aboveBand';
  else if (eaten >= band.low) status = 'inBand';
  else status = 'under';
  return {
    status,
    eaten,
    target,
    left: oneDecimal(target - eaten),
    aimLow: band.low,
    aimHigh: band.high,
    fraction: Math.min(Math.max(eaten / target, 0), 1),
  };
}

// Protein is a floor: met once eaten reaches it, else how much is still to go.
export function floorStatus(eaten, floor) {
  if (floor == null) return { status: 'noTarget', eaten, floor: null, left: null };
  return {
    status: eaten >= floor ? 'met' : 'short',
    eaten,
    floor,
    left: oneDecimal(Math.max(0, floor - eaten)),
  };
}

// Carbs and fat are optional ranges. The form keeps the two ends paired, so when one is
// missing both are; a missing pair means no target at all.
export function rangeStatus(eaten, low, high) {
  if (low == null && high == null) return { status: 'noTarget', eaten, low: null, high: null };
  let status = 'inRange';
  if (low != null && eaten < low) status = 'under';
  else if (high != null && eaten > high) status = 'over';
  return { status, eaten, low, high };
}

// Protein, carbs and fat against the Targets, for the day bar.
export function macroBar(totals, targets) {
  return {
    protein: floorStatus(totals.protein, targets.proteinFloor),
    carbs: rangeStatus(totals.carbs, targets.carbLow, targets.carbHigh),
    fat: rangeStatus(totals.fat, targets.fatLow, targets.fatHigh),
  };
}

// ---- Logging ---------------------------------------------------------------------------

// Turns the amount typed on the form into grams. In servings it needs the food's serving size.
// Returns { ok, grams, servings } (servings null for grams) or { ok: false, error }.
export function amountToGrams({ amount, unit, servingGrams }) {
  const text = String(amount ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(text) || Number(text) <= 0) {
    return { ok: false, error: 'today.log.errors.amount' };
  }
  const value = Number(text);
  let grams = value;
  let servings = null;
  if (unit === 'servings') {
    if (!(Number(servingGrams) > 0)) {
      return { ok: false, error: 'today.log.errors.servingUnknown' };
    }
    servings = value;
    grams = value * Number(servingGrams);
  }
  grams = Math.round(grams * 10) / 10;
  if (grams <= 0) return { ok: false, error: 'today.log.errors.amount' };
  if (grams > MAX_LOG_GRAMS) return { ok: false, error: 'today.log.errors.tooLarge' };
  return { ok: true, grams, servings };
}

// The calories and macros for a food at this many grams. Each value is null when the food
// does not have it (a USDA search hit has no macros until it is saved).
export function entryNutrition(food, grams) {
  const macros = food.macros || {};
  return {
    kcal: scaleToGrams(food.kcalPer100g ?? null, grams),
    protein: scaleToGrams(macros.protein ?? null, grams),
    carbs: scaleToGrams(macros.carbs ?? null, grams),
    fat: scaleToGrams(macros.fat ?? null, grams),
  };
}

// The Calorie Log row for one entry. A Meal Time entry has no log_time; an entry at another
// time records the clock time it was logged.
export function buildLogRow({
  memberId,
  logDate,
  food,
  grams,
  servings,
  nutrition,
  mealTimeId,
  logTime,
}) {
  return {
    member_id: memberId,
    log_date: logDate,
    meal_time_id: mealTimeId ?? null,
    log_time: mealTimeId ? null : logTime,
    food_id: food.id,
    description: food.name,
    servings,
    grams,
    kcal: nutrition.kcal,
    protein_g: nutrition.protein,
    carbs_g: nutrition.carbs,
    fat_g: nutrition.fat,
  };
}

// Checks what the log form needs before saving. Returns the first problem as a translation
// key, or null when the entry can be logged.
export function logProblem({ food, amount, unit, logDate, todayKey }) {
  if (!food) return 'today.log.errors.food';
  if (isFutureDay(logDate, todayKey)) return 'today.log.errors.futureDay';
  const parsed = amountToGrams({ amount, unit, servingGrams: food.servingGrams });
  if (!parsed.ok) return parsed.error;
  if (entryNutrition(food, parsed.grams).kcal == null) return 'today.log.errors.noKcal';
  return null;
}
