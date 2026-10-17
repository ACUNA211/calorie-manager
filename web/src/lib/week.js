// Week view data access: one Member's Calorie Log for a whole week, in one query. Targets come
// from targets.js (loadTargets), as on Today. Row-level security (migration 007) limits the
// rows to Members the caller may act for. Takes the Supabase client as its first argument.

// Only the columns the week's totals need.
export const WEEK_ENTRY_COLUMNS = 'log_date, kcal, protein_g, carbs_g, fat_g';

// The Calorie Log rows of one Member from startKey to endKey, both 'YYYY-MM-DD' and inclusive.
export async function loadWeek(client, memberId, startKey, endKey) {
  const { data, error } = await client
    .from('calorie_log')
    .select(WEEK_ENTRY_COLUMNS)
    .eq('member_id', memberId)
    .gte('log_date', startKey)
    .lte('log_date', endKey);
  if (error) throw error;
  return data || [];
}
