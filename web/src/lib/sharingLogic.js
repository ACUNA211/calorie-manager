// Pure rules for what other Members see: the per-day status a Member's day shows to another
// adult, and which Members an adult sees on the Week view. No React and no Supabase here.
// The statuses match weekLogic.js: a logged day is under when its calories are at or below the
// Calorie Target, so "on track" is under and "over" is above it.

import { weekKeys } from './weekLogic.js';

export const DAY_STATUS = {
  ON_TRACK: 'onTrack',
  OVER: 'over',
  NOTHING: 'nothing',
  NO_TARGET: 'noTarget',
};

// The status of one day from a Week view day (weekLogic.dayStats).
export function statusOfDay(day) {
  if (!day.logged) return DAY_STATUS.NOTHING;
  if (day.under == null) return DAY_STATUS.NO_TARGET;
  return day.under ? DAY_STATUS.ON_TRACK : DAY_STATUS.OVER;
}

// The seven statuses of a week (Sunday first) from the day flags the database returns for a
// Member who does not share everything: rows of { day_key, is_over }, one per logged day.
// A day with no row has nothing logged; is_over null means the Member has no Calorie Target.
export function flagsForWeek(rows, startKey) {
  const byDay = new Map((rows || []).map((row) => [row.day_key, row.is_over]));
  return weekKeys(startKey).map((key) => {
    if (!byDay.has(key)) return { key, status: DAY_STATUS.NOTHING, kcal: null };
    const isOver = byDay.get(key);
    if (isOver === null || isOver === undefined) {
      return { key, status: DAY_STATUS.NO_TARGET, kcal: null };
    }
    return { key, status: isOver ? DAY_STATUS.OVER : DAY_STATUS.ON_TRACK, kcal: null };
  });
}

// The other adult Members of the Household: everyone except the signed-in adult, and never a
// Dependent (Dependents are reached through "logging for").
export function otherAdults(members, myMemberId) {
  return (members || []).filter(
    (member) => member.role !== 'dependent' && member.id !== myMemberId
  );
}
