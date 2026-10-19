// Data access for the Intake form (ticket #64). Takes the Supabase client first so tests can
// pass a fake. The answers live in member_intake (migration 042); the Targets themselves are
// saved with saveTargets from targets.js, the same path as Targets by hand.

export const INTAKE_COLUMNS =
  'sex, birth_date, height_cm, work, exercise_sessions, exercise_minutes, goal, pace_kcal, floor_on, floor_kcal';

// The Member's saved answers, or null when they have none yet.
export async function loadIntake(client, memberId) {
  const { data, error } = await client
    .from('member_intake')
    .select(INTAKE_COLUMNS)
    .eq('member_id', memberId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Saves the answers and the floor setting. Upsert, so a first save creates the row.
export async function saveIntake(client, memberId, values) {
  const { error } = await client
    .from('member_intake')
    .upsert(
      { member_id: memberId, ...values, updated_at: new Date().toISOString() },
      { onConflict: 'member_id' }
    );
  if (error) throw error;
}
