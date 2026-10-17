// Sharing data access (ticket #33). Every function takes the Supabase client as its first
// argument so tests can pass a fake. Row-level security (migration 032) decides what each read
// returns; the RPCs are the only way to change the "share everything" switch.

import { loadWeek } from './week.js';
import { loadTargets } from './targets.js';
import { buildWeek, weekEndKey } from './weekLogic.js';
import { targetView } from './todayLogic.js';
import { flagsForWeek, otherAdults, statusOfDay } from './sharingLogic.js';

// The signed-in user's id, or null when nobody is signed in.
export async function currentUserId(client) {
  const { data } = await client.auth.getSession();
  return data?.session?.user?.id ?? null;
}

// The signed-in adult's own Member and whether they share everything. Null with no Member.
export async function loadOwnSharing(client, userId) {
  const { data, error } = await client
    .from('members')
    .select('id, share_everything')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { memberId: data.id, shareEverything: data.share_everything === true };
}

// Turns the caller's own "share everything" switch on or off.
export async function setShareEverything(client, share) {
  const { error } = await client.rpc('set_share_everything', { p_share: share === true });
  if (error) throw error;
}

// The other adult Members of the signed-in adult's Household, with whether each shares
// everything. Null when the caller has no Member.
export async function loadHouseholdAdults(client, userId) {
  const { data: me, error: meError } = await client
    .from('members')
    .select('id, household_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (meError) throw meError;
  if (!me) return null;

  const { data, error } = await client
    .from('members')
    .select('id, display_name, role, share_everything')
    .eq('household_id', me.household_id)
    .order('created_at', { ascending: true });
  if (error) throw error;

  return {
    myMemberId: me.id,
    members: otherAdults(data || [], me.id).map((member) => ({
      id: member.id,
      name: member.display_name,
      shareEverything: member.share_everything === true,
    })),
  };
}

// One Member's per-day flags for a week, from the database function. No calories are returned.
export async function loadMemberFlags(client, memberId, startKey, endKey) {
  const { data, error } = await client.rpc('member_day_flags', {
    p_member_id: memberId,
    p_start: startKey,
    p_end: endKey,
  });
  if (error) throw error;
  return data || [];
}

// The other adults' weeks for the Week view. A Member who shares everything gets their full
// week (calories per day and the status against their Target). Anyone else gets only the flag
// per day. Sunday to Saturday from startKey; todayKey only fixes which days count as future.
export async function loadHouseholdWeeks(client, userId, startKey, todayKey) {
  const household = await loadHouseholdAdults(client, userId);
  if (!household) return [];
  const endKey = weekEndKey(startKey);

  return Promise.all(
    household.members.map(async (member) => {
      if (member.shareEverything) {
        const [entries, targetRow] = await Promise.all([
          loadWeek(client, member.id, startKey, endKey),
          loadTargets(client, member.id),
        ]);
        const view = buildWeek(entries, startKey, targetView(targetRow), todayKey);
        return {
          ...member,
          shared: true,
          days: view.days.map((day) => ({
            key: day.key,
            status: statusOfDay(day),
            kcal: day.logged ? day.totals.kcal : null,
          })),
        };
      }
      const rows = await loadMemberFlags(client, member.id, startKey, endKey);
      return { ...member, shared: false, days: flagsForWeek(rows, startKey) };
    })
  );
}
