// Household and Member Preferences (ticket 37). Data access takes the Supabase client as its
// first argument so tests can pass a fake. Row-level security (migration 037) decides who may
// read and write: any Member for the Household's row, the Member and the adults for a Member's.

export const HOUSEHOLD_COLUMNS =
  'household_id, cuisines, weeknight_minutes, weekend_minutes, equipment, repeat_frequency, leftovers_tolerance, budget_feel';
export const MEMBER_COLUMNS =
  'member_id, favourites, dislikes, hard_foods, hard_food_groups, hard_diets';

// The Household a Member belongs to.
export async function loadMemberHouseholdId(client, memberId) {
  const { data, error } = await client
    .from('members')
    .select('household_id')
    .eq('id', memberId)
    .maybeSingle();
  if (error) throw error;
  return data ? data.household_id : null;
}

export async function loadHouseholdPreferences(client, householdId) {
  const { data, error } = await client
    .from('household_preferences')
    .select(HOUSEHOLD_COLUMNS)
    .eq('household_id', householdId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveHouseholdPreferences(client, householdId, values) {
  const { error } = await client
    .from('household_preferences')
    .upsert(
      { household_id: householdId, ...values, updated_at: new Date().toISOString() },
      { onConflict: 'household_id' }
    );
  if (error) throw error;
}

export async function loadMemberPreferences(client, memberId) {
  const { data, error } = await client
    .from('member_preferences')
    .select(MEMBER_COLUMNS)
    .eq('member_id', memberId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveMemberPreferences(client, memberId, values) {
  const { error } = await client
    .from('member_preferences')
    .upsert(
      { member_id: memberId, ...values, updated_at: new Date().toISOString() },
      { onConflict: 'member_id' }
    );
  if (error) throw error;
}
