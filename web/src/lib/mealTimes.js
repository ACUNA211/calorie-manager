// Meal Times data access. Every function takes the Supabase client as its first argument
// so tests can pass a fake. Row-level security (migrations 007 and 013) limits reads and
// writes to Meal Times the caller's Members share. A Meal Time's name, time, kind and
// weekdays are shared; each sharing Member's calorie range is on meal_time_members.

import { draftToRow, normalizeSharerIds, normalizeTime } from './mealTimesLogic.js';

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

// Every Member of the caller's Household (RLS limits the rows to that Household), for the
// sharing picker.
export async function loadMembers(client) {
  const { data, error } = await client
    .from('members')
    .select('id, display_name, role')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

// One Member's Meal Times, in time order. Each comes with this Member's range and the
// Members sharing it (createdBy is the creator, who is always among them).
export async function loadMealTimes(client, memberId) {
  const { data, error } = await client
    .from('meal_time_members')
    .select(
      'cal_min, cal_max, set_calories, meal_times(id, name, time_of_day, weekdays, kind, member_id)'
    )
    .eq('member_id', memberId);
  if (error) throw error;

  const meals = (data || [])
    .filter((row) => row.meal_times)
    .map((row) => ({
      id: row.meal_times.id,
      name: row.meal_times.name,
      time_of_day: normalizeTime(row.meal_times.time_of_day),
      weekdays: row.meal_times.weekdays,
      kind: row.meal_times.kind,
      createdBy: row.meal_times.member_id,
      cal_min: row.cal_min,
      cal_max: row.cal_max,
      set_calories: row.set_calories,
      sharers: [],
    }))
    .sort((a, b) => a.time_of_day.localeCompare(b.time_of_day) || a.id - b.id);

  if (meals.length === 0) return meals;

  const { data: sharerRows, error: sharerError } = await client
    .from('meal_time_members')
    .select('meal_time_id, member_id, members(display_name)')
    .in(
      'meal_time_id',
      meals.map((meal) => meal.id)
    );
  if (sharerError) throw sharerError;

  for (const row of sharerRows || []) {
    const meal = meals.find((candidate) => candidate.id === row.meal_time_id);
    if (meal) {
      meal.sharers.push({ id: row.member_id, name: row.members?.display_name ?? '' });
    }
  }
  return meals;
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

// Inserts or updates a Meal Time (draft.id set) and its sharers in one call, through
// save_meal_time(). The Member's own range comes from the draft; a new sharer starts with it.
// Returns the Meal Time id.
export async function saveMealTime(client, memberId, draft) {
  const row = draftToRow(draft);
  const { data, error } = await client.rpc('save_meal_time', {
    p_member_id: memberId,
    p_meal_time_id: draft.id ?? null,
    p_name: row.name,
    p_time_of_day: row.time_of_day,
    p_kind: row.kind,
    p_weekdays: row.weekdays,
    p_cal_min: row.cal_min,
    p_cal_max: row.cal_max,
    p_set_calories: row.set_calories,
    p_sharer_ids: normalizeSharerIds(draft.sharerIds, draft.createdBy ?? memberId, memberId),
  });
  if (error) throw error;
  return data;
}

// Sets the weekdays of one Meal Time. The weekdays are shared, so every sharer sees the change.
export async function setWeekdays(client, memberId, mealTimeId, weekdays) {
  const sorted = [...new Set(weekdays)].sort((a, b) => a - b);
  const { error } = await client
    .from('meal_times')
    .update({ weekdays: sorted })
    .eq('id', mealTimeId);
  if (error) throw error;
}

// The creator deletes the Meal Time for everyone. Any other sharer only stops sharing it:
// their own row goes and the others' stay as they are.
export async function deleteMealTime(client, memberId, mealTimeId, createdBy) {
  if (createdBy === memberId) {
    const { error } = await client
      .from('meal_times')
      .delete()
      .eq('id', mealTimeId)
      .eq('member_id', memberId);
    if (error) throw error;
    return;
  }
  const { error } = await client
    .from('meal_time_members')
    .delete()
    .eq('meal_time_id', mealTimeId)
    .eq('member_id', memberId);
  if (error) throw error;
}
