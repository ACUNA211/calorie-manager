// Household data access. Every function takes the Supabase client as its first
// argument so tests can pass a fake. Row-level security already limits reads to
// the caller's own Household.

export async function loadHousehold(client, userId) {
  const { data: me, error: meError } = await client
    .from('members')
    .select('household_id, role')
    .eq('user_id', userId)
    .maybeSingle();
  if (meError) throw meError;
  if (!me) return null;

  const [householdResult, membersResult] = await Promise.all([
    client.from('households').select('id, name').eq('id', me.household_id).single(),
    client
      .from('members')
      .select('id, display_name, role')
      .eq('household_id', me.household_id)
      .order('created_at', { ascending: true }),
  ]);
  if (householdResult.error) throw householdResult.error;
  if (membersResult.error) throw membersResult.error;

  return {
    id: householdResult.data.id,
    name: householdResult.data.name,
    myRole: me.role,
    members: membersResult.data,
  };
}

export async function createHousehold(client, { name, ownerName }) {
  const { data, error } = await client.rpc('create_household', {
    p_name: name,
    p_owner_name: ownerName,
  });
  if (error) throw error;
  return data;
}
