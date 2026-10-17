import { describe, expect, it, vi } from 'vitest';
import { WEIGHT_COLUMNS, deleteWeight, loadWeight, saveWeight } from './weight.js';

// A chainable fake of the Supabase query builder, as in week.test.js.
function fakeClient(result) {
  const calls = [];
  const builder = {};
  for (const method of ['select', 'eq', 'gte', 'lte', 'order', 'upsert', 'delete']) {
    builder[method] = vi.fn((...args) => {
      calls.push([method, ...args]);
      return builder;
    });
  }
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return {
    calls,
    from: vi.fn((table) => {
      calls.push(['from', table]);
      return builder;
    }),
  };
}

describe('loadWeight', () => {
  it('reads one Member range, inclusive of both ends, oldest first', async () => {
    const rows = [{ id: 1, log_date: '2026-10-11', kg: 72.5 }];
    const client = fakeClient({ data: rows, error: null });
    await expect(loadWeight(client, 4, '2026-07-20', '2026-10-17')).resolves.toEqual(rows);
    expect(client.calls).toEqual([
      ['from', 'weight_log'],
      ['select', WEIGHT_COLUMNS],
      ['eq', 'member_id', 4],
      ['gte', 'log_date', '2026-07-20'],
      ['lte', 'log_date', '2026-10-17'],
      ['order', 'log_date', { ascending: true }],
    ]);
  });

  it('returns an empty list when there are no rows', async () => {
    const client = fakeClient({ data: null, error: null });
    await expect(loadWeight(client, 4, '2026-10-11', '2026-10-17')).resolves.toEqual([]);
  });

  it('throws the database error', async () => {
    const error = new Error('network down');
    const client = fakeClient({ data: null, error });
    await expect(loadWeight(client, 4, '2026-10-11', '2026-10-17')).rejects.toBe(error);
  });
});

describe('saveWeight', () => {
  it('upserts one weight per Member per day', async () => {
    const client = fakeClient({ data: null, error: null });
    await saveWeight(client, 4, '2026-10-17', 72.5);
    expect(client.from).toHaveBeenCalledWith('weight_log');
    const upsert = client.calls.find((call) => call[0] === 'upsert');
    expect(upsert[1]).toMatchObject({ member_id: 4, log_date: '2026-10-17', kg: 72.5 });
    expect(upsert[2]).toEqual({ onConflict: 'member_id,log_date' });
  });

  it('throws the database error', async () => {
    const error = new Error('row level security');
    const client = fakeClient({ data: null, error });
    await expect(saveWeight(client, 4, '2026-10-17', 72.5)).rejects.toBe(error);
  });
});

describe('deleteWeight', () => {
  it('deletes the entry with that id', async () => {
    const client = fakeClient({ data: null, error: null });
    await deleteWeight(client, 9);
    expect(client.calls).toEqual([['from', 'weight_log'], ['delete'], ['eq', 'id', 9]]);
  });

  it('throws the database error', async () => {
    const error = new Error('nope');
    const client = fakeClient({ data: null, error });
    await expect(deleteWeight(client, 9)).rejects.toBe(error);
  });
});
