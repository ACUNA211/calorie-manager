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
  lookupGtin,
  matchesTokens,
  displayName,
  translateFoodName,
  saveUsdaFoodAndTranslate,
  saveFoodNames,
  FOOD_COLUMNS,
} from './foods.js';
import { searchTokens } from './norm.js';

// Open Food Facts fallback (ticket 19): the Edge Function answers, the USDA step does not.
const offProduct = {
  product_name: 'Oat drink',
  brands: 'Oatly',
  serving_quantity: 250,
  serving_quantity_unit: 'ml',
  nutriments: { 'energy-kcal_100g': 46, proteins_100g: 1 },
};

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

// Spanish names (ticket #16)
const apples = {
  ...oats,
  id: 3,
  name: 'Apples, raw',
  name_es: 'Manzana cruda',
  name_es_edited_by_member: true,
  source: 'label',
  source_id: null,
  servings: [],
};

describe('Spanish names', () => {
  it('reads the Spanish name and whether a Member wrote it', () => {
    expect(libraryResult(apples)).toMatchObject({ nameEs: 'Manzana cruda', nameEsEdited: true });
    expect(
      libraryResult({ ...apples, name_es: null, name_es_edited_by_member: false })
    ).toMatchObject({
      nameEs: null,
      nameEsEdited: false,
    });
  });

  it('a USDA hit has no Spanish name until it is saved', () => {
    expect(usdaResult({ fdc_id: 9, name: 'Oats' })).toMatchObject({
      nameEs: null,
      nameEsEdited: false,
    });
  });

  it('reads the Spanish name columns in the library query', async () => {
    const client = fakeClient({ foods: { data: [], error: null } });
    await searchLibrary(client, 'manzana');
    expect(client.chain.select).toHaveBeenCalledWith(FOOD_COLUMNS);
    expect(FOOD_COLUMNS).toContain('name_es');
  });

  it('finds an English food by its Spanish name', () => {
    const rows = [libraryResult(apples), libraryResult({ ...oats, id: 4, name: 'Rolled oats' })];
    expect(rankLibrary(rows, 'manzana').map((r) => r.id)).toEqual([3]);
  });

  it('finds an English food by its English name too', () => {
    expect(rankLibrary([libraryResult(apples)], 'apples').map((r) => r.id)).toEqual([3]);
  });

  it('lets each word of a query match a different name', () => {
    const result = libraryResult(apples);
    expect(matchesTokens(result, searchTokens('apples manzana'))).toBe(true);
    expect(matchesTokens(result, searchTokens('apples pera'))).toBe(false);
  });

  it('folds accents in the Spanish name', () => {
    const result = libraryResult({ ...apples, name: 'Paprika', name_es: 'Pimentón dulce' });
    expect(rankLibrary([result], 'pimenton')).toHaveLength(1);
  });

  it('ranks a Spanish name that starts with the word first', () => {
    const rows = [
      libraryResult({ ...oats, id: 1, name: 'Sweet bread, pan dulce' }),
      libraryResult({ ...apples, id: 2, name: 'Brown rice', name_es: 'Pan de maíz' }),
    ];
    expect(rankLibrary(rows, 'pan').map((r) => r.id)).toEqual([2, 1]);
  });

  it('shows the Spanish name on a Spanish screen when there is one', () => {
    const result = libraryResult(apples);
    expect(displayName(result, 'es')).toBe('Manzana cruda');
    expect(displayName(result, 'en')).toBe('Apples, raw');
  });

  it('falls back to the English name on a Spanish screen with no Spanish name', () => {
    expect(displayName(libraryResult({ ...apples, name_es: null }), 'es')).toBe('Apples, raw');
    expect(displayName(usdaResult({ fdc_id: 9, name: 'Oats' }), 'es')).toBe('Oats');
  });
});

// A fake that records update() and functions.invoke() calls.
function writeClient({
  updateError = null,
  invoke = { data: { status: 'translated' }, error: null },
  rpc = {},
} = {}) {
  const update = vi.fn();
  const eq = vi.fn(async () => ({ error: updateError }));
  update.mockImplementation(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  const functions = { invoke: vi.fn(async () => invoke) };
  const rpcMock = vi.fn(async (name) => rpc[name] ?? { data: null, error: null });
  return { from, update, eq, functions, rpc: rpcMock };
}

describe('saveFoodNames', () => {
  it('saves both names, trimmed, for one food', async () => {
    const client = writeClient();

    await saveFoodNames(client, 3, { name: '  Apples, raw ', nameEs: ' Manzana cruda ' });

    expect(client.from).toHaveBeenCalledWith('foods');
    expect(client.update).toHaveBeenCalledWith({ name: 'Apples, raw', name_es: 'Manzana cruda' });
    expect(client.eq).toHaveBeenCalledWith('id', 3);
  });

  it('stores an empty Spanish name as null', async () => {
    const client = writeClient();

    await saveFoodNames(client, 3, { name: 'Apples', nameEs: '   ' });

    expect(client.update).toHaveBeenCalledWith({ name: 'Apples', name_es: null });
  });

  it('refuses an empty English name without writing', async () => {
    const client = writeClient();

    await expect(saveFoodNames(client, 3, { name: '  ', nameEs: 'x' })).rejects.toThrow(
      'cannot be empty'
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  it('throws when the database refuses the write', async () => {
    const client = writeClient({ updateError: new Error('denied') });

    await expect(saveFoodNames(client, 3, { name: 'Apples', nameEs: '' })).rejects.toThrow(
      'denied'
    );
  });
});

describe('translateFoodName and saveUsdaFoodAndTranslate', () => {
  it('asks translate-food-name for the food and returns its answer', async () => {
    const client = writeClient({
      invoke: { data: { status: 'translated', name_es: 'Manzana' }, error: null },
    });

    expect(await translateFoodName(client, '9')).toEqual({
      status: 'translated',
      name_es: 'Manzana',
    });
    expect(client.functions.invoke).toHaveBeenCalledWith('translate-food-name', {
      body: { food_id: 9 },
    });
  });

  it('throws when the function call fails', async () => {
    const client = writeClient({ invoke: { data: null, error: new Error('down') } });

    await expect(translateFoodName(client, 9)).rejects.toThrow('down');
  });

  it('saves a USDA food and then translates it', async () => {
    const client = writeClient({ rpc: { usda_save: { data: 42, error: null } } });

    expect(await saveUsdaFoodAndTranslate(client, 173904)).toEqual({
      id: 42,
      spanish: 'translated',
    });
    expect(client.functions.invoke).toHaveBeenCalledWith('translate-food-name', {
      body: { food_id: 42 },
    });
  });

  it('keeps the saved food when translation fails', async () => {
    const client = writeClient({
      rpc: { usda_save: { data: 42, error: null } },
      invoke: { data: null, error: new Error('no key') },
    });

    expect(await saveUsdaFoodAndTranslate(client, 173904)).toEqual({ id: 42, spanish: 'failed' });
  });

  it('reports the cap answer when the monthly limit is reached', async () => {
    const client = writeClient({
      rpc: { usda_save: { data: 42, error: null } },
      invoke: { data: { status: 'limit_reached' }, error: null },
    });

    expect(await saveUsdaFoodAndTranslate(client, 173904)).toEqual({
      id: 42,
      spanish: 'limit_reached',
    });
  });

  it('does not translate when the save fails', async () => {
    const client = writeClient({ rpc: { usda_save: { data: null, error: new Error('boom') } } });

    await expect(saveUsdaFoodAndTranslate(client, 1)).rejects.toThrow('boom');
    expect(client.functions.invoke).not.toHaveBeenCalled();
  });
});

describe('lookupGtin', () => {
  const UPC_A = '036000291452';
  const libraryRow = {
    id: 7,
    name: 'Oat flakes',
    brand: 'Brand',
    source: 'usda',
    source_id: '555',
    kcal_per_100g: 370,
    servings: [],
    protein_g: 13,
    carbs_g: 60,
    fat_g: 7,
    fibre_g: null,
    sugars_g: null,
    sodium_mg: null,
  };
  const usdaHit = {
    fdc_id: 999,
    name: 'Oats, branded',
    brand: 'Brand',
    kcal_per_100g: 380,
    serving_g: 40,
    serving_label: '1 cup',
  };

  // A client whose usda_lookup_gtin answers `lookupAnswer`, and whose foods table holds
  // `row` when the answer is a Food Library id.
  function fakeClient({ lookupAnswer, row = libraryRow, error, rowError } = {}) {
    const rpc = vi.fn(async () => ({ data: lookupAnswer, error: error ?? null }));
    const single = vi.fn(async () => ({ data: row, error: rowError ?? null }));
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    return { rpc, from, select, eq, single };
  }

  it('asks the database once, with the 14-digit form', async () => {
    const client = fakeClient({ lookupAnswer: null });
    await lookupGtin(client, UPC_A);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith('usda_lookup_gtin', { p_code: '00036000291452' });
  });

  it('finds a Food Library food without any USDA function call', async () => {
    const client = fakeClient({ lookupAnswer: { food_id: 7 } });
    const outcome = await lookupGtin(client, `0${UPC_A}`);
    expect(outcome.status).toBe('found');
    expect(outcome.source).toBe('library');
    expect(outcome.result.id).toBe(7);
    expect(outcome.result.macros.protein).toBe(13);
    expect(client.from).toHaveBeenCalledWith('foods');
    expect(client.eq).toHaveBeenCalledWith('id', 7);
    expect(client.rpc.mock.calls.map(([name]) => name)).toEqual(['usda_lookup_gtin']);
  });

  it('returns a USDA Branded hit, ready to save', async () => {
    const client = fakeClient({ lookupAnswer: usdaHit });
    const outcome = await lookupGtin(client, UPC_A);
    expect(outcome).toEqual({ status: 'found', source: 'usda', result: usdaResult(usdaHit) });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('says not found when neither source has the code', async () => {
    const client = fakeClient({ lookupAnswer: null });
    client.functions = {
      invoke: vi.fn(async () => ({ data: { status: 'notFound' }, error: null })),
    };
    expect(await lookupGtin(client, UPC_A)).toEqual({ status: 'notFound' });
  });

  it('refuses a code that fails its check digit without calling the database', async () => {
    const client = fakeClient({ lookupAnswer: null });
    expect(await lookupGtin(client, '036000291453')).toEqual({ status: 'invalid' });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('throws when the lookup call fails', async () => {
    const client = fakeClient({ error: new Error('down') });
    await expect(lookupGtin(client, UPC_A)).rejects.toThrow('down');
  });
});

describe('lookupGtin falls back to Open Food Facts (ticket 19)', () => {
  const UPC_A = '036000291452';

  // USDA and the Food Library miss; functions.invoke answers `offAnswer` (or throws).
  function missingClient({ offAnswer, offError } = {}) {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const invoke = vi.fn(async () =>
      offError ? { data: null, error: offError } : { data: offAnswer, error: null }
    );
    return { rpc, functions: { invoke } };
  }

  it('returns an Open Food Facts product as found, with source off', async () => {
    const client = missingClient({
      offAnswer: {
        status: 'found',
        barcode: '36000291452',
        offCode: '0036000291452',
        product: offProduct,
      },
    });
    const outcome = await lookupGtin(client, UPC_A);
    expect(outcome.status).toBe('found');
    expect(outcome.source).toBe('off');
    expect(outcome.result).toMatchObject({
      key: 'off:36000291452',
      name: 'Oat drink',
      brand: 'Oatly',
      kcalPer100g: 46,
      servingGrams: 250,
    });
    expect(client.functions.invoke).toHaveBeenCalledWith('off-lookup', { body: { code: UPC_A } });
  });

  it('is not asked when the Food Library or USDA already has the food', async () => {
    const client = missingClient({ offAnswer: { status: 'notFound' } });
    client.rpc = vi.fn(async () => ({ data: { food_id: 7 }, error: null }));
    client.from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { id: 7, name: 'X', kcal_per_100g: 1 }, error: null }),
        }),
      }),
    }));
    const outcome = await lookupGtin(client, UPC_A);
    expect(outcome.source).toBe('library');
    expect(client.functions.invoke).not.toHaveBeenCalled();
  });

  it('says not found when Open Food Facts has no such code', async () => {
    const outcome = await lookupGtin(missingClient({ offAnswer: { status: 'notFound' } }), UPC_A);
    expect(outcome).toEqual({ status: 'notFound' });
  });

  it('passes on the rate limit as offStatus, so the screen can say try again', async () => {
    const outcome = await lookupGtin(
      missingClient({ offAnswer: { status: 'rateLimited' } }),
      UPC_A
    );
    expect(outcome).toEqual({ status: 'notFound', offStatus: 'rateLimited' });
  });

  it('treats a failed Open Food Facts call as unavailable, never as a thrown error', async () => {
    const outcome = await lookupGtin(missingClient({ offError: new Error('down') }), UPC_A);
    expect(outcome).toEqual({ status: 'notFound', offStatus: 'unavailable' });
  });

  it('does not ask Open Food Facts for a code that fails its check digit', async () => {
    const client = missingClient({ offAnswer: { status: 'notFound' } });
    expect(await lookupGtin(client, '036000291453')).toEqual({ status: 'invalid' });
    expect(client.functions.invoke).not.toHaveBeenCalled();
  });
});

describe('typed label foods (ticket 20)', () => {
  it('marks a food saved from a label, and no other library food', () => {
    expect(libraryResult({ ...oats, source: 'label', source_id: null }).typedFromLabel).toBe(true);
    expect(libraryResult(oats).typedFromLabel).toBe(false);
  });
});
