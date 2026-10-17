// Weight log data access: one Member's weight entries for a date range, and saving or deleting
// one entry. One entry per Member per day (migration 030), so saving a day that already has a
// weight replaces it. Row-level security limits the rows to Members the caller may read or
// write. Takes the Supabase client as its first argument, as the other data modules do.

export const WEIGHT_COLUMNS = 'id, log_date, kg';

// The weight entries of one Member from startKey to endKey, both 'YYYY-MM-DD' and inclusive,
// oldest first.
export async function loadWeight(client, memberId, startKey, endKey) {
  const { data, error } = await client
    .from('weight_log')
    .select(WEIGHT_COLUMNS)
    .eq('member_id', memberId)
    .gte('log_date', startKey)
    .lte('log_date', endKey)
    .order('log_date', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Saves the weight for one day. Upsert on (member, day), so logging a day again replaces it.
export async function saveWeight(client, memberId, logDate, kg) {
  const { error } = await client.from('weight_log').upsert(
    {
      member_id: memberId,
      log_date: logDate,
      kg,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'member_id,log_date' }
  );
  if (error) throw error;
}

// Deletes one weight entry by its id.
export async function deleteWeight(client, id) {
  const { error } = await client.from('weight_log').delete().eq('id', id);
  if (error) throw error;
}
