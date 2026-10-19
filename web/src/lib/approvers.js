// Who may approve the Meal Plan (migration 041). The Owner always may; the Owner can allow or
// disallow each adult Member. Members rows are write-protected, so the flag changes only
// through set_member_can_approve(), which checks the caller is the Owner.
// Every function takes the Supabase client first so tests can pass a fake.

// The Household's adult Members (not the Owner, not Dependents) with whether each may approve.
export async function loadApprovers(client) {
  const { data, error } = await client
    .from('members')
    .select('id, display_name, can_approve')
    .eq('role', 'member')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    name: row.display_name,
    allowed: row.can_approve === true,
  }));
}

export async function setMemberCanApprove(client, memberId, allowed) {
  const { error } = await client.rpc('set_member_can_approve', {
    p_member_id: memberId,
    p_allowed: allowed,
  });
  if (error) throw error;
}
