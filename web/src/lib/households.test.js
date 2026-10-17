import { describe, it, expect, vi } from 'vitest';
import { createHousehold, loadHousehold } from './households.js';

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
          { data: { household_id: 7, role: 'owner' }, error: null },
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
