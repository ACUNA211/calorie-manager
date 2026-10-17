// Household data access. Every function takes the Supabase client as its first
// argument so tests can pass a fake. Row-level security already limits reads to
// the caller's own Household. Dependents are changed only through the RPCs in
// migration 014, which check that the caller is the Owner.

export const DEPENDENT_NAME_MAX = 60;

export async function loadHousehold(client, userId) {
  const { data: me, error: meError } = await client
    .from('members')
    .select('id, household_id, role')
    .eq('user_id', userId)
    .maybeSingle();
  if (meError) throw meError;
  if (!me) return null;

  const [householdResult, membersResult] = await Promise.all([
    client.from('households').select('id, name').eq('id', me.household_id).single(),
    client
      .from('members')
      .select('id, display_name, role, display_units')
      .eq('household_id', me.household_id)
      .order('created_at', { ascending: true }),
  ]);
  if (householdResult.error) throw householdResult.error;
  if (membersResult.error) throw membersResult.error;

  return {
    id: householdResult.data.id,
    name: householdResult.data.name,
    myRole: me.role,
    myMemberId: me.id,
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

// A Dependent's name: trimmed, not empty, at most DEPENDENT_NAME_MAX characters.
// Returns translation keys for errors, so the screen shows them through t().
export function validateDependentName(text) {
  const name = String(text ?? '').trim();
  if (name === '') return { ok: false, error: 'household.dependents.errors.nameRequired' };
  if ([...name].length > DEPENDENT_NAME_MAX) {
    return { ok: false, error: 'household.dependents.errors.nameTooLong' };
  }
  return { ok: true, value: name };
}

export async function addDependent(client, name) {
  const { data, error } = await client.rpc('add_dependent', { p_name: name });
  if (error) throw error;
  return data;
}

export async function renameDependent(client, memberId, name) {
  const { error } = await client.rpc('rename_dependent', { p_member_id: memberId, p_name: name });
  if (error) throw error;
}

// Deletes the Dependent and everything logged for them (Meal Times, Calorie Log, Targets).
export async function removeDependent(client, memberId) {
  const { error } = await client.rpc('remove_dependent', { p_member_id: memberId });
  if (error) throw error;
}
