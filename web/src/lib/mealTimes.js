// Meal Times data access. Every function takes the Supabase client as its first argument
// so tests can pass a fake. Row-level security (migration 007) already limits reads and
// writes to the caller's own Member and their Dependents; the member_id filters keep each
// call to one Member too.

import { normalizeTime, draftToRow } from './mealTimesLogic.js';

const MEAL_TIME_COLUMNS = 'id, name, time_of_day, weekdays, kind, cal_min, cal_max, set_calories';

// The Member for a login, or null when the person has no Household yet.
export async function loadMemberId(client, userId) {
  const { data, error } = await client
    .from('members')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? data.id : null;
}

export async function loadMealTimes(client, memberId) {
  const { data, error } = await client
    .from('meal_times')
    .select(MEAL_TIME_COLUMNS)
    .eq('member_id', memberId)
    .order('time_of_day', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({ ...row, time_of_day: normalizeTime(row.time_of_day) }));
}

// The Calorie Target and band for a Member. Read only here; ticket 10 edits them.
export async function loadTargets(client, memberId) {
  const { data, error } = await client
    .from('member_settings')
    .select('calorie_target, band_low_pct, band_high_pct')
    .eq('member_id', memberId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Inserts a new Meal Time, or updates the one with draft.id. `draft` is a valid editor draft.
export async function saveMealTime(client, memberId, draft) {
  const row = draftToRow(draft);
  if (draft.id) {
    const { error } = await client
      .from('meal_times')
      .update(row)
      .eq('id', draft.id)
      .eq('member_id', memberId);
    if (error) throw error;
    return draft.id;
  }
  const { data, error } = await client
    .from('meal_times')
    .insert({ ...row, member_id: memberId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

// Sets the weekdays of one Meal Time (a toggle, or the replace side of a clash).
export async function setWeekdays(client, memberId, mealTimeId, weekdays) {
  const sorted = [...new Set(weekdays)].sort((a, b) => a - b);
  const { error } = await client
    .from('meal_times')
    .update({ weekdays: sorted })
    .eq('id', mealTimeId)
    .eq('member_id', memberId);
  if (error) throw error;
}

export async function deleteMealTime(client, memberId, mealTimeId) {
  const { error } = await client
    .from('meal_times')
    .delete()
    .eq('id', mealTimeId)
    .eq('member_id', memberId);
  if (error) throw error;
}
