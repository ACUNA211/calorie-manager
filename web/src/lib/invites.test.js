import { describe, it, expect, vi } from 'vitest';
import {
  acceptErrorKey,
  acceptInvite,
  buildInviteUrl,
  createInvite,
  peekInvite,
  readInviteToken,
} from './invites.js';

// A fake client: insert/select/single for the table, and rpc for the functions.
function fakeClient({ insertResult, rpc } = {}) {
  const q = {
    insert: vi.fn(() => q),
    select: vi.fn(() => q),
    single: vi.fn(async () => insertResult),
  };
  return {
    from: vi.fn(() => q),
    rpc: rpc ?? vi.fn(),
    query: q,
  };
}

describe('readInviteToken', () => {
  it('reads the token from ?invite=', () => {
    expect(readInviteToken('?invite=abc123')).toBe('abc123');
  });

  it('returns null when there is no usable invite', () => {
    expect(readInviteToken('')).toBeNull();
    expect(readInviteToken('?other=1')).toBeNull();
    expect(readInviteToken('?invite=%20')).toBeNull();
  });
});

describe('buildInviteUrl', () => {
  it('builds a link on the same page with the token encoded', () => {
    expect(buildInviteUrl({ origin: 'https://app.example', pathname: '/' }, 'a b')).toBe(
      'https://app.example/?invite=a%20b'
    );
  });
});

describe('createInvite', () => {
  it('inserts a link for the Household and returns its token and expiry', async () => {
    const client = fakeClient({
      insertResult: { data: { token: 'tok', expires_at: '2026-10-24T00:00:00Z' }, error: null },
    });

    const result = await createInvite(client, 7);

    expect(client.from).toHaveBeenCalledWith('household_invites');
    expect(client.query.insert).toHaveBeenCalledWith({ household_id: 7 });
    expect(result).toEqual({ token: 'tok', expires_at: '2026-10-24T00:00:00Z' });
  });

  it('throws the database error when the insert is refused', async () => {
    const error = { message: 'new row violates row-level security policy' };
    const client = fakeClient({ insertResult: { data: null, error } });

    await expect(createInvite(client, 7)).rejects.toEqual(error);
  });
});

describe('peekInvite', () => {
  it('returns the Household name and status of the link', async () => {
    const rpc = vi.fn(async () => ({
      data: [{ household_name: 'Acuna home', status: 'valid' }],
      error: null,
    }));

    expect(await peekInvite({ rpc }, 'tok')).toEqual({
      householdName: 'Acuna home',
      status: 'valid',
    });
    expect(rpc).toHaveBeenCalledWith('peek_invite', { p_token: 'tok' });
  });

  it('returns null when no link matches', async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));

    expect(await peekInvite({ rpc }, 'nope')).toBeNull();
  });
});

describe('acceptInvite', () => {
  it('calls accept_invite with the token and the typed name', async () => {
    const rpc = vi.fn(async () => ({ data: 7, error: null }));

    expect(await acceptInvite({ rpc }, 'tok', 'Ana')).toBe(7);
    expect(rpc).toHaveBeenCalledWith('accept_invite', { p_token: 'tok', p_display_name: 'Ana' });
  });
});

describe('acceptErrorKey', () => {
  it.each([
    ['invite_not_found', 'notFound'],
    ['invite_revoked', 'revoked'],
    ['invite_used', 'used'],
    ['invite_expired', 'expired'],
    ['already_in_household', 'alreadyInHousehold'],
    ['something else', 'joinFailed'],
  ])('maps %s to %s', (message, key) => {
    expect(acceptErrorKey({ message })).toBe(key);
  });
});
