import { describe, it, expect, vi } from 'vitest';
import {
  libraryResult,
  usdaResult,
  rankLibrary,
  mergeResults,
  scaleToGrams,
  nutritionFor,
  searchFoods,
  searchLibrary,
  searchUsda,
  saveUsdaFood,
} from './foods.js';

const oats = {
  id: 1,
  name: 'Rolled oats',
  brand: null,
  source: 'usda',
  source_id: '173904',
  kcal_per_100g: 379,
  servings: [{ label: '1 cup', grams: 80 }],
  protein_g: 13.2,
  carbs_g: 67.7,
  fat_g: 6.5,
  fibre_g: 10.1,
  sugars_g: 0,
  sodium_mg: 2,
};

// A fake client: from() returns a chain whose limit() resolves to `foods`; rpc() answers
// per function name from `rpc`.
function fakeClient({ foods = { data: [], error: null }, rpc = {} } = {}) {
  const chain = {
    select: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(foods)),
  };
  const from = vi.fn(() => chain);
  const rpcMock = vi.fn(async (name) => rpc[name] ?? { data: null, error: null });
  return { from, rpc: rpcMock, chain };
}

describe('libraryResult and usdaResult', () => {
  it('reads a Food Library row with its first serving and its macros', () => {
    const result = libraryResult(oats);

    expect(result).toMatchObject({
      key: 'library:1',
      source: 'library',
      usdaId: '173904',
      name: 'Rolled oats',
      kcalPer100g: 379,
      servingGrams: 80,
      servingLabel: '1 cup',
    });
    expect(result.macros).toEqual({
      protein: 13.2,
      carbs: 67.7,
      fat: 6.5,
      fibre: 10.1,
      sugars: 0,
      sodium: 2,
    });
  });

  it('keeps a missing macro as null, not 0', () => {
    const result = libraryResult({ ...oats, fibre_g: null, servings: [] });

    expect(result.macros.fibre).toBeNull();
    expect(result.servingGrams).toBeNull();
    expect(result.servingLabel).toBeNull();
  });

  it('reads a USDA search hit with calories only', () => {
    const result = usdaResult({
      fdc_id: 173904,
      name: 'Oats',
      brand: '',
      kcal_per_100g: 379,
      serving_g: 80,
      serving_label: '1 cup',
    });

    expect(result).toMatchObject({
      key: 'usda:173904',
      source: 'usda',
      fdcId: 173904,
      usdaId: '173904',
      brand: null,
      kcalPer100g: 379,
      servingGrams: 80,
    });
    expect(result.macros).toBeNull();
  });
});

describe('rankLibrary', () => {
  const rows = [
    libraryResult({ ...oats, id: 1, name: 'Whole wheat bread' }),
    libraryResult({ ...oats, id: 2, name: 'Jalapeño, pickled' }),
    libraryResult({ ...oats, id: 3, name: 'Bread crumbs', brand: 'Acme' }),
    libraryResult({ ...oats, id: 4, name: 'Brown bread roll' }),
  ];

  it('matches accents and case with plain typing', () => {
    expect(rankLibrary(rows, 'JALAPENO').map((r) => r.id)).toEqual([2]);
  });

  it('matches a plural to its singular', () => {
    expect(rankLibrary(rows, 'breads').map((r) => r.name)).toEqual([
      'Bread crumbs',
      'Brown bread roll',
      'Whole wheat bread',
    ]);
  });

  it('puts names that start with the first word first, then sorts by name', () => {
    expect(rankLibrary(rows, 'bread').map((r) => r.name)).toEqual([
      'Bread crumbs',
      'Brown bread roll',
      'Whole wheat bread',
    ]);
  });

  it('matches the brand too', () => {
    expect(rankLibrary(rows, 'acme').map((r) => r.id)).toEqual([3]);
  });

  it('returns nothing for an empty query', () => {
    expect(rankLibrary(rows, '   ')).toEqual([]);
  });
});

describe('mergeResults', () => {
  it('lists library results before USDA results', () => {
    const library = [libraryResult({ ...oats, id: 1, source: 'label', source_id: null })];
    const usda = [usdaResult({ fdc_id: 9, name: 'Oats', kcal_per_100g: 380 })];

    expect(mergeResults(library, usda).map((r) => r.key)).toEqual(['library:1', 'usda:9']);
  });

  it('leaves out a USDA hit that is already in the Food Library', () => {
    const library = [libraryResult(oats)];
    const usda = [
      usdaResult({ fdc_id: 173904, name: 'Oats', kcal_per_100g: 379 }),
      usdaResult({ fdc_id: 5, name: 'Oat bran', kcal_per_100g: 246 }),
    ];

    expect(mergeResults(library, usda).map((r) => r.key)).toEqual(['library:1', 'usda:5']);
  });
});

describe('scaleToGrams and nutritionFor', () => {
  it('scales a value to grams and rounds to one decimal', () => {
    expect(scaleToGrams(379, 80)).toBe(303.2);
    expect(scaleToGrams(13.2, 80)).toBe(10.6);
  });

  it('keeps a missing value or a missing serving as null', () => {
    expect(scaleToGrams(null, 80)).toBeNull();
    expect(scaleToGrams(10, null)).toBeNull();
  });

  it('gives per 100 g and per serving for a library food', () => {
    const view = nutritionFor(libraryResult(oats));

    expect(view.per100g).toEqual({
      kcal: 379,
      protein: 13.2,
      carbs: 67.7,
      fat: 6.5,
      fibre: 10.1,
      sugars: 0,
      sodium: 2,
    });
    expect(view.perServing).toMatchObject({
      grams: 80,
      label: '1 cup',
      kcal: 303.2,
      protein: 10.6,
    });
  });

  it('gives no per-serving numbers when the food has no serving size', () => {
    const view = nutritionFor(usdaResult({ fdc_id: 5, name: 'Oat bran', kcal_per_100g: 246 }));

    expect(view.per100g.kcal).toBe(246);
    expect(view.per100g.protein).toBeNull();
    expect(view.perServing).toBeNull();
  });
});

describe('data access', () => {
  it('searchLibrary reads the Household foods and ranks them', async () => {
    const client = fakeClient({ foods: { data: [oats], error: null } });

    const results = await searchLibrary(client, 'oat');

    expect(client.from).toHaveBeenCalledWith('foods');
    expect(client.chain.limit).toHaveBeenCalledWith(2000);
    expect(results.map((r) => r.key)).toEqual(['library:1']);
  });

  it('searchLibrary does not query for a blank search', async () => {
    const client = fakeClient();

    expect(await searchLibrary(client, '  ')).toEqual([]);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('searchUsda calls usda_search with the trimmed query', async () => {
    const client = fakeClient({
      rpc: {
        usda_search: { data: [{ fdc_id: 5, name: 'Oat bran', kcal_per_100g: 246 }], error: null },
      },
    });

    const results = await searchUsda(client, '  oat bran ');

    expect(client.rpc).toHaveBeenCalledWith('usda_search', {
      p_query: 'oat bran',
      p_page_size: 12,
    });
    expect(results.map((r) => r.key)).toEqual(['usda:5']);
  });

  it('searchFoods keeps the library results when USDA fails', async () => {
    const client = fakeClient({
      foods: { data: [oats], error: null },
      rpc: { usda_search: { data: null, error: new Error('USDA down') } },
    });

    const outcome = await searchFoods(client, 'oat');

    expect(outcome.results.map((r) => r.key)).toEqual(['library:1']);
    expect(outcome.usdaFailed).toBe(true);
    expect(outcome.libraryFailed).toBe(false);
  });

  it('searchFoods reports a library failure and still shows USDA results', async () => {
    const client = fakeClient({
      foods: { data: null, error: new Error('no access') },
      rpc: {
        usda_search: { data: [{ fdc_id: 5, name: 'Oat bran', kcal_per_100g: 246 }], error: null },
      },
    });

    const outcome = await searchFoods(client, 'oat');

    expect(outcome.results.map((r) => r.key)).toEqual(['usda:5']);
    expect(outcome.libraryFailed).toBe(true);
    expect(outcome.usdaFailed).toBe(false);
  });

  it('saveUsdaFood calls usda_save and returns the Food Library id', async () => {
    const client = fakeClient({ rpc: { usda_save: { data: 42, error: null } } });

    expect(await saveUsdaFood(client, 173904)).toBe(42);
    expect(client.rpc).toHaveBeenCalledWith('usda_save', { p_fdc_id: 173904 });
  });

  it('saveUsdaFood throws when the save fails', async () => {
    const client = fakeClient({ rpc: { usda_save: { data: null, error: new Error('boom') } } });

    await expect(saveUsdaFood(client, 1)).rejects.toThrow('boom');
  });
});
