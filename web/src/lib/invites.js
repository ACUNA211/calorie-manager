// Household invite links. Each function takes the Supabase client as its first argument so
// tests can pass a fake. The database enforces the rules (Owner only, single use, expiry);
// this file only builds the link and turns the database's message codes into keys.

export const INVITE_PARAM = 'invite';

// Reads ?invite=<token> from a query string such as window.location.search, or null.
export function readInviteToken(search) {
  const token = new URLSearchParams(search || '').get(INVITE_PARAM);
  return token && token.trim() ? token.trim() : null;
}

// The link the Owner shares, on the same page: <origin><path>?invite=<token>.
export function buildInviteUrl(location, token) {
  return `${location.origin}${location.pathname}?${INVITE_PARAM}=${encodeURIComponent(token)}`;
}

// Creates a link for a Household the caller owns. Returns { token, expires_at }.
export async function createInvite(client, householdId) {
  const { data, error } = await client
    .from('household_invites')
    .insert({ household_id: householdId })
    .select('token, expires_at')
    .single();
  if (error) throw error;
  return data;
}

// Peeks at a link for the landing screen. Returns { householdName, status } where status is
// 'valid', 'revoked', 'used' or 'expired', or null when the link does not exist.
export async function peekInvite(client, token) {
  const { data, error } = await client.rpc('peek_invite', { p_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  return row ? { householdName: row.household_name, status: row.status } : null;
}

// Joins the caller to the link's Household as a Member. Returns the Household id.
export async function acceptInvite(client, token, displayName) {
  const { data, error } = await client.rpc('accept_invite', {
    p_token: token,
    p_display_name: displayName,
  });
  if (error) throw error;
  return data;
}

// Maps a database error from accept_invite to a translation key under "invite.errors".
const ACCEPT_ERRORS = {
  invite_not_found: 'notFound',
  invite_revoked: 'revoked',
  invite_used: 'used',
  invite_expired: 'expired',
  already_in_household: 'alreadyInHousehold',
};

export function acceptErrorKey(error) {
  return ACCEPT_ERRORS[error?.message] ?? 'joinFailed';
}
