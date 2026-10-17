import { describe, expect, it, vi } from 'vitest';
import {
  ENTRY_COLUMNS,
  deleteEntry,
  insertEntry,
  libraryFoodFor,
  loadDay,
  loadFood,
  restoreEntry,
  updateEntry,
} from './today.js';
import { FOOD_COLUMNS } from './foods.js';

// A chainable fake of the Supabase query builder. Each call records itself, and the chain
// resolves to `result` when awaited (or to `single` results when .single() is used).
function fakeClient(result) {
  const calls = [];
  const builder = {};
  for (const method of ['select', 'eq', 'order', 'insert', 'update', 'delete']) {
    builder[method] = vi.fn((...args) => {
      calls.push([method, ...args]);
      return builder;
    });
  }
  builder.single = vi.fn(async () => {
    calls.push(['single']);
    return result;
  });
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  const client = {
    calls,
    from: vi.fn((table) => {
      calls.push(['from', table]);
      return builder;
    }),
    rpc: vi.fn(async (name, args) => {
      calls.push(['rpc', name, args]);
      return result;
    }),
  };
  return client;
}

describe('loadDay', () => {
  it('reads the Member day in the order logged', async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    const client = fakeClient({ data: rows, error: null });
    await expect(loadDay(client, 4, '2026-10-17')).resolves.toEqual(rows);
    expect(client.calls).toEqual([
      ['from', 'calorie_log'],
      ['select', ENTRY_COLUMNS],
      ['eq', 'member_id', 4],
      ['eq', 'log_date', '2026-10-17'],
      ['order', 'created_at', { ascending: true }],
      ['order', 'id', { ascending: true }],
    ]);
  });

  it('returns an empty list when there are no rows', async () => {
    const client = fakeClient({ data: null, error: null });
    await expect(loadDay(client, 4, '2026-10-17')).resolves.toEqual([]);
  });

  it('throws the database error', async () => {
    const error = new Error('denied');
    const client = fakeClient({ data: null, error });
    await expect(loadDay(client, 4, '2026-10-17')).rejects.toBe(error);
  });
});

describe('insertEntry', () => {
  it('inserts the row and returns it as stored', async () => {
    const stored = { id: 9, kcal: 150 };
    const client = fakeClient({ data: stored, error: null });
    const row = { member_id: 4, kcal: 150 };
    await expect(insertEntry(client, row)).resolves.toEqual(stored);
    expect(client.calls).toEqual([
      ['from', 'calorie_log'],
      ['insert', row],
      ['select', ENTRY_COLUMNS],
      ['single'],
    ]);
  });

  it('throws when the insert fails', async () => {
    const error = new Error('check violation');
    const client = fakeClient({ data: null, error });
    await expect(insertEntry(client, { member_id: 4 })).rejects.toBe(error);
  });
});

describe('loadFood', () => {
  it('reads one Food Library row as a search result with its macros', async () => {
    const client = fakeClient({
      data: {
        id: 7,
        name: 'Oats',
        brand: null,
        source: 'usda',
        source_id: '173904',
        kcal_per_100g: 389,
        servings: [{ label: 'cup', grams: 80 }],
        protein_g: 16.9,
        carbs_g: 66.3,
        fat_g: 6.9,
        fibre_g: null,
        sugars_g: null,
        sodium_mg: null,
      },
      error: null,
    });
    const food = await loadFood(client, 7);
    expect(client.calls[1]).toEqual(['select', FOOD_COLUMNS]);
    expect(client.calls[2]).toEqual(['eq', 'id', 7]);
    expect(food).toMatchObject({
      key: 'library:7',
      source: 'library',
      id: 7,
      name: 'Oats',
      kcalPer100g: 389,
      servingGrams: 80,
      servingLabel: 'cup',
    });
    expect(food.macros.protein).toBe(16.9);
    expect(food.macros.fibre).toBeNull();
  });
});

describe('libraryFoodFor', () => {
  it('returns a Food Library result unchanged, without saving anything', async () => {
    const client = fakeClient({ data: null, error: null });
    const result = { source: 'library', id: 3, name: 'Rice' };
    await expect(libraryFoodFor(client, result)).resolves.toBe(result);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('saves a USDA result to the Food Library and reads back its row', async () => {
    const client = fakeClient({ data: 55, error: null });
    // The rpc result is 55 (the new Food Library id); the follow-up read is the same fake, so
    // give it a row that the read path can turn into a result.
    client.from = vi.fn(() => {
      const builder = {};
      builder.select = vi.fn(() => builder);
      builder.eq = vi.fn(() => builder);
      builder.single = vi.fn(async () => ({
        data: { id: 55, name: 'Apple', kcal_per_100g: 52, source: 'usda', source_id: '1' },
        error: null,
      }));
      return builder;
    });
    const food = await libraryFoodFor(client, { source: 'usda', fdcId: 1, name: 'Apple' });
    expect(client.rpc).toHaveBeenCalledWith('usda_save', { p_fdc_id: 1 });
    expect(food).toMatchObject({ id: 55, name: 'Apple', kcalPer100g: 52, source: 'library' });
  });
});

describe('updateEntry', () => {
  it('updates one row of the Calorie Log and returns it as stored', async () => {
    const row = { id: 5, grams: 120, kcal: 1000 };
    const client = fakeClient({ data: row, error: null });
    await expect(updateEntry(client, 5, { grams: 120, kcal: 1000 })).resolves.toEqual(row);
    expect(client.calls).toEqual([
      ['from', 'calorie_log'],
      ['update', { grams: 120, kcal: 1000 }],
      ['eq', 'id', 5],
      ['select', ENTRY_COLUMNS],
      ['single'],
    ]);
  });

  it('throws the database error, so a refused update is never shown as saved', async () => {
    const error = new Error('denied');
    const client = fakeClient({ data: null, error });
    await expect(updateEntry(client, 5, { grams: 120 })).rejects.toBe(error);
  });
});

describe('deleteEntry', () => {
  it('deletes one row of the Calorie Log', async () => {
    const client = fakeClient({ data: [{ id: 5 }], error: null });
    await expect(deleteEntry(client, 5)).resolves.toBeUndefined();
    expect(client.calls).toEqual([
      ['from', 'calorie_log'],
      ['delete'],
      ['eq', 'id', 5],
      ['select', 'id'],
    ]);
  });

  it('throws when no row was deleted, for example when row-level security refused it', async () => {
    const client = fakeClient({ data: [], error: null });
    await expect(deleteEntry(client, 5)).rejects.toThrow('not deleted');
  });

  it('throws the database error', async () => {
    const error = new Error('denied');
    const client = fakeClient({ data: null, error });
    await expect(deleteEntry(client, 5)).rejects.toBe(error);
  });
});

describe('restoreEntry', () => {
  it('inserts the restored row and returns it as stored', async () => {
    const row = { member_id: 4, description: 'Toast', grams: 60 };
    const client = fakeClient({ data: { id: 77, ...row }, error: null });
    await expect(restoreEntry(client, row)).resolves.toEqual({ id: 77, ...row });
    expect(client.calls).toEqual([
      ['from', 'calorie_log'],
      ['insert', row],
      ['select', ENTRY_COLUMNS],
      ['single'],
    ]);
  });
});
