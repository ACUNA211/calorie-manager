import { describe, it, expect, vi } from 'vitest';
import {
  addToPantry,
  correctPantryItem,
  foodIdFor,
  loadFoodPackage,
  loadPantry,
  pantryItemFromRow,
  setPackageGrams,
} from './pantry.js';

// A client that answers the calls pantry.js makes and records them.
function fakeClient({ rows = [], rpc = {}, error = null } = {}) {
  const calls = { select: [], order: [], rpc: [] };
  const chain = {
    select: (columns) => {
      calls.select.push(columns);
      return chain;
    },
    order: async (column, options) => {
      calls.order.push([column, options]);
      return error ? { data: null, error } : { data: rows, error: null };
    },
  };
  const client = {
    from: vi.fn(() => chain),
    rpc: vi.fn(async (name, args) => {
      calls.rpc.push([name, args]);
      if (error) return { data: null, error };
      return rpc[name] ? rpc[name](args) : { data: null, error: null };
    }),
  };
  return { client, calls };
}

describe('pantryItemFromRow', () => {
  it('reads the amount and the food', () => {
    expect(
      pantryItemFromRow({
        id: 3,
        food_id: 9,
        grams: '150.0',
        foods: { name: 'Rice', brand: null, store_section: 'Pantry' },
      })
    ).toEqual({
      id: 3,
      foodId: 9,
      grams: 150,
      name: 'Rice',
      brand: null,
      storeSection: 'Pantry',
    });
  });

  it('falls back to an empty name and the Other section when the food is missing', () => {
    expect(pantryItemFromRow({ id: 3, food_id: 9, grams: 0, foods: null })).toMatchObject({
      name: '',
      storeSection: 'Other',
    });
  });
});

describe('loadPantry', () => {
  it('reads the Household Pantry with each food, in row order', async () => {
    const rows = [
      { id: 1, food_id: 5, grams: 40, foods: { name: 'Oats', store_section: 'Pantry' } },
    ];
    const { client, calls } = fakeClient({ rows });

    const items = await loadPantry(client);

    expect(client.from).toHaveBeenCalledWith('pantry_items');
    expect(calls.select[0]).toBe('id, food_id, grams, foods(name, brand, store_section)');
    expect(calls.order[0]).toEqual(['id', { ascending: true }]);
    expect(items).toEqual([
      { id: 1, foodId: 5, grams: 40, name: 'Oats', brand: null, storeSection: 'Pantry' },
    ]);
  });

  it('throws when the read fails', async () => {
    const { client } = fakeClient({ error: new Error('offline') });
    await expect(loadPantry(client)).rejects.toThrow('offline');
  });
});

describe('foodIdFor', () => {
  it('uses a Food Library result as it is', async () => {
    const { client } = fakeClient();
    await expect(foodIdFor(client, { source: 'library', id: 12 })).resolves.toBe(12);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('saves a USDA result to the Food Library first and uses the new id', async () => {
    const { client } = fakeClient({ rpc: { usda_save: () => ({ data: 77, error: null }) } });
    await expect(foodIdFor(client, { source: 'usda', fdcId: 2345 })).resolves.toBe(77);
    expect(client.rpc).toHaveBeenCalledWith('usda_save', { p_fdc_id: 2345 });
  });
});

describe('addToPantry', () => {
  it('calls pantry_add with the food and the grams', async () => {
    const { client, calls } = fakeClient({
      rpc: { pantry_add: () => ({ data: 4, error: null }) },
    });
    await expect(addToPantry(client, 5, 50)).resolves.toBe(4);
    expect(calls.rpc).toEqual([['pantry_add', { p_food_id: 5, p_grams: 50 }]]);
  });

  it('throws when the database refuses the add', async () => {
    const { client } = fakeClient({ error: new Error('not in your Food Library') });
    await expect(addToPantry(client, 5, 50)).rejects.toThrow('not in your Food Library');
  });
});

describe('correctPantryItem', () => {
  it('sends used up without a typed amount', async () => {
    const { client, calls } = fakeClient({
      rpc: { pantry_correct: () => ({ data: 0, error: null }) },
    });
    await expect(correctPantryItem(client, 3, 'used_up')).resolves.toBe(0);
    expect(calls.rpc).toEqual([
      ['pantry_correct', { p_item_id: 3, p_action: 'used_up', p_grams: null }],
    ]);
  });

  it('sends a typed amount and returns the new amount as a number', async () => {
    const { client, calls } = fakeClient({
      rpc: { pantry_correct: () => ({ data: '33.3', error: null }) },
    });
    await expect(correctPantryItem(client, 3, 'set', 33.3)).resolves.toBe(33.3);
    expect(calls.rpc[0]).toEqual([
      'pantry_correct',
      { p_item_id: 3, p_action: 'set', p_grams: 33.3 },
    ]);
  });
});

describe('loadFoodPackage and setPackageGrams (ticket #26)', () => {
  it('reads the food name, package weight and servings', async () => {
    const { client, calls } = fakeClient();
    const chain = {
      select: (columns) => {
        calls.select.push(columns);
        return chain;
      },
      eq: (column, value) => {
        calls.eq = [column, value];
        return chain;
      },
      single: async () => ({
        data: {
          id: 7,
          name: 'Soup',
          package_grams: '425.0',
          servings: [{ label: '1 can', grams: 425 }],
        },
        error: null,
      }),
    };
    client.from = vi.fn(() => chain);

    expect(await loadFoodPackage(client, '7')).toEqual({
      id: 7,
      name: 'Soup',
      packageGrams: 425,
      servings: [{ label: '1 can', grams: 425 }],
    });
    expect(client.from).toHaveBeenCalledWith('foods');
    expect(calls.eq).toEqual(['id', 7]);
  });

  it('keeps an unset package weight as null', async () => {
    const { client } = fakeClient();
    client.from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: 7, name: 'Rice', package_grams: null, servings: null },
            error: null,
          }),
        }),
      }),
    }));
    expect(await loadFoodPackage(client, 7)).toEqual({
      id: 7,
      name: 'Rice',
      packageGrams: null,
      servings: [],
    });
  });

  it('sets the package weight through set_package_grams', async () => {
    const { client, calls } = fakeClient({
      rpc: { set_package_grams: () => ({ data: 425, error: null }) },
    });
    expect(await setPackageGrams(client, '7', 425)).toBe(425);
    expect(calls.rpc).toEqual([['set_package_grams', { p_food_id: 7, p_grams: 425 }]]);
  });

  it('throws when the weight cannot be saved', async () => {
    const { client } = fakeClient({ error: new Error('nope') });
    await expect(setPackageGrams(client, 7, 425)).rejects.toThrow('nope');
  });
});
