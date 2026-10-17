import { describe, it, expect, vi } from 'vitest';
import {
  addDependent,
  createHousehold,
  loadHousehold,
  removeDependent,
  renameDependent,
  validateDependentName,
} from './households.js';

// A fake Supabase client. Each table gets a queue of results, one per query.
function fakeClient({ tables = {}, rpc } = {}) {
  const queues = Object.fromEntries(
    Object.entries(tables).map(([name, results]) => [name, [...results]])
  );
  const from = vi.fn((table) => {
    const result = queues[table].shift();
    const q = {
      select: () => q,
      eq: () => q,
      order: () => Promise.resolve(result),
      maybeSingle: () => Promise.resolve(result),
      single: () => Promise.resolve(result),
    };
    return q;
  });
  return { from, rpc: rpc ?? vi.fn() };
}

describe('loadHousehold', () => {
  it('returns null when the person has no Household', async () => {
    const client = fakeClient({ tables: { members: [{ data: null, error: null }] } });

    expect(await loadHousehold(client, 'user-1')).toBeNull();
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it('returns the Household with its Members and their roles', async () => {
    const client = fakeClient({
      tables: {
        members: [
          { data: { id: 1, household_id: 7, role: 'owner' }, error: null },
          {
            data: [
              { id: 1, display_name: 'Sergio', role: 'owner' },
              { id: 2, display_name: 'Ana', role: 'member' },
              { id: 3, display_name: 'Lucia', role: 'dependent' },
            ],
            error: null,
          },
        ],
        households: [{ data: { id: 7, name: 'Acuna home' }, error: null }],
      },
    });

    expect(await loadHousehold(client, 'user-1')).toEqual({
      id: 7,
      name: 'Acuna home',
      myRole: 'owner',
      myMemberId: 1,
      members: [
        { id: 1, display_name: 'Sergio', role: 'owner' },
        { id: 2, display_name: 'Ana', role: 'member' },
        { id: 3, display_name: 'Lucia', role: 'dependent' },
      ],
    });
  });

  it('throws when a query fails', async () => {
    const boom = { message: 'permission denied' };
    const client = fakeClient({ tables: { members: [{ data: null, error: boom }] } });

    await expect(loadHousehold(client, 'user-1')).rejects.toEqual(boom);
  });
});

describe('createHousehold', () => {
  it('calls the create_household RPC with the trimmed-by-server name and owner name', async () => {
    const rpc = vi.fn(async () => ({ data: 42, error: null }));
    const client = fakeClient({ rpc });

    const id = await createHousehold(client, { name: 'Acuna home', ownerName: 'Sergio' });

    expect(rpc).toHaveBeenCalledWith('create_household', {
      p_name: 'Acuna home',
      p_owner_name: 'Sergio',
    });
    expect(id).toBe(42);
  });

  it('throws the database error when the RPC fails', async () => {
    const error = { message: 'You already belong to a Household' };
    const client = fakeClient({ rpc: vi.fn(async () => ({ data: null, error })) });

    await expect(createHousehold(client, { name: 'Second', ownerName: 'Sergio' })).rejects.toEqual(
      error
    );
  });
});

describe('validateDependentName', () => {
  it('trims the name and keeps it', () => {
    expect(validateDependentName('  Kid  ')).toEqual({ ok: true, value: 'Kid' });
  });

  it('refuses an empty or blank name', () => {
    expect(validateDependentName('   ')).toEqual({
      ok: false,
      error: 'household.dependents.errors.nameRequired',
    });
    expect(validateDependentName(undefined)).toEqual({
      ok: false,
      error: 'household.dependents.errors.nameRequired',
    });
  });

  it('allows 60 characters and refuses 61', () => {
    expect(validateDependentName('k'.repeat(60)).ok).toBe(true);
    expect(validateDependentName('k'.repeat(61))).toEqual({
      ok: false,
      error: 'household.dependents.errors.nameTooLong',
    });
  });

  it('counts characters, not UTF-16 units', () => {
    expect(validateDependentName('😀'.repeat(60)).ok).toBe(true);
    expect(validateDependentName('😀'.repeat(61)).ok).toBe(false);
  });
});

describe('Dependent RPCs', () => {
  it('addDependent calls add_dependent and returns the new Member id', async () => {
    const rpc = vi.fn(async () => ({ data: 12, error: null }));

    expect(await addDependent(fakeClient({ rpc }), 'Kid')).toBe(12);
    expect(rpc).toHaveBeenCalledWith('add_dependent', { p_name: 'Kid' });
  });

  it('renameDependent calls rename_dependent with the Member id', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));

    await renameDependent(fakeClient({ rpc }), 12, 'Kiddo');
    expect(rpc).toHaveBeenCalledWith('rename_dependent', { p_member_id: 12, p_name: 'Kiddo' });
  });

  it('removeDependent calls remove_dependent with the Member id', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));

    await removeDependent(fakeClient({ rpc }), 12);
    expect(rpc).toHaveBeenCalledWith('remove_dependent', { p_member_id: 12 });
  });

  it.each([
    ['addDependent', (client) => addDependent(client, 'Kid')],
    ['renameDependent', (client) => renameDependent(client, 12, 'Kiddo')],
    ['removeDependent', (client) => removeDependent(client, 12)],
  ])('%s throws the database error', async (_name, call) => {
    const error = { message: 'Only the Owner can add a Dependent' };
    const client = fakeClient({ rpc: vi.fn(async () => ({ data: null, error })) });

    await expect(call(client)).rejects.toEqual(error);
  });
});
