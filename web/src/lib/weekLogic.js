// Pure rules for the Week view: the Sunday-to-Saturday week, each day's totals against the
// Targets and the Planning band, days under the Calorie Target and the week's averages. No
// React and no Supabase here. Day maths and the calorie and macro statuses come from
// todayLogic.js, so the Week view and Today always agree.

import { addDays, calorieBar, macroBar, sumEntries, weekdayOf } from './todayLogic.js';

// The Sunday on or before the key: the first day of its week.
export function weekStartKey(key) {
  return addDays(key, -weekdayOf(key));
}

// The week `weeks` weeks after (or before, when negative) the week starting on `startKey`.
export function shiftWeek(startKey, weeks) {
  return addDays(startKey, 7 * weeks);
}

// The last day of the week (the Saturday).
export function weekEndKey(startKey) {
  return addDays(startKey, 6);
}

// The seven day keys of the week, Sunday first.
export function weekKeys(startKey) {
  return Array.from({ length: 7 }, (_, index) => addDays(startKey, index));
}

// The Calorie Log rows grouped by day, so each day can be totalled on its own.
export function groupByDay(entries) {
  const byDay = new Map();
  for (const entry of entries || []) {
    const list = byDay.get(entry.log_date);
    if (list) list.push(entry);
    else byDay.set(entry.log_date, [entry]);
  }
  return byDay;
}

const oneDecimal = (value) => Math.round(value * 10) / 10;

// One day of the week. A day with nothing logged has no totals, no band and no macros (not
// zero), and it does not count as under. A logged day is under when its calories are at or
// below the Calorie Target, which is a ceiling. With no Calorie Target `under` is null.
export function dayStats(key, entries, targets, todayKey) {
  if (!entries.length) {
    return {
      key,
      logged: false,
      isFuture: key > todayKey,
      totals: null,
      bar: null,
      macros: null,
      under: null,
    };
  }
  const totals = sumEntries(entries);
  const bar = calorieBar(totals.kcal, targets);
  return {
    key,
    logged: true,
    isFuture: key > todayKey,
    totals,
    bar,
    macros: macroBar(totals, targets),
    under: bar.target == null ? null : totals.kcal <= bar.target,
  };
}

// The average of one figure over the given logged days, to one decimal. Null with no days.
function averageOf(days, pick) {
  if (!days.length) return null;
  const sum = days.reduce((total, day) => total + pick(day.totals), 0);
  return oneDecimal(sum / days.length);
}

// The whole week: seven days (Sunday first) and the summary. Averages and the count of days
// under use logged days only. `missingMacroDays` counts logged days with a meal that has no
// macro figures, so the screen can say that their macro totals may be low.
export function buildWeek(entries, startKey, targets, todayKey) {
  const byDay = groupByDay(entries);
  const days = weekKeys(startKey).map((key) =>
    dayStats(key, byDay.get(key) || [], targets, todayKey)
  );
  const logged = days.filter((day) => day.logged);
  const hasTarget = targets?.calorieTarget != null;
  return {
    startKey,
    endKey: weekEndKey(startKey),
    days,
    summary: {
      loggedCount: logged.length,
      underCount: hasTarget ? logged.filter((day) => day.under).length : null,
      average: {
        kcal: averageOf(logged, (totals) => totals.kcal),
        protein: averageOf(logged, (totals) => totals.protein),
        carbs: averageOf(logged, (totals) => totals.carbs),
        fat: averageOf(logged, (totals) => totals.fat),
      },
      missingMacroDays: logged.filter((day) => day.totals.missingMacros > 0).length,
    },
  };
}
