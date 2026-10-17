import { describe, expect, it, vi } from 'vitest';
import { WEEK_ENTRY_COLUMNS, loadWeek } from './week.js';

// A chainable fake of the Supabase query builder, as in today.test.js.
function fakeClient(result) {
  const calls = [];
  const builder = {};
  for (const method of ['select', 'eq', 'gte', 'lte']) {
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

describe('loadWeek', () => {
  it('reads one Member week in a single query, inclusive of both ends', async () => {
    const rows = [{ log_date: '2026-10-11', kcal: 900 }];
    const client = fakeClient({ data: rows, error: null });
    await expect(loadWeek(client, 4, '2026-10-11', '2026-10-17')).resolves.toEqual(rows);
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(client.calls).toEqual([
      ['from', 'calorie_log'],
      ['select', WEEK_ENTRY_COLUMNS],
      ['eq', 'member_id', 4],
      ['gte', 'log_date', '2026-10-11'],
      ['lte', 'log_date', '2026-10-17'],
    ]);
  });

  it('returns an empty list when the week has no rows', async () => {
    const client = fakeClient({ data: null, error: null });
    await expect(loadWeek(client, 4, '2026-10-11', '2026-10-17')).resolves.toEqual([]);
  });

  it('throws the database error instead of returning a partial week', async () => {
    const error = new Error('network down');
    const client = fakeClient({ data: null, error });
    await expect(loadWeek(client, 4, '2026-10-11', '2026-10-17')).rejects.toBe(error);
  });
});
