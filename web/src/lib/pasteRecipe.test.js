import { describe, it, expect, vi } from 'vitest';
import {
  canContinue,
  chooseMatch,
  draftFromParsed,
  gramsFor,
  matchRecipeLines,
  newRow,
  parseRecipeText,
  PasteError,
  resolveIngredients,
  rowNeedsCheck,
  rowWithFood,
  rowWithGrams,
  searchCandidates,
  RECIPE_UNITS,
} from './pasteRecipe.js';
import { RECIPE_UNITS as SERVER_UNITS } from '../../../supabase/functions/_shared/parse-recipe.ts';

const eggs = {
  key: 'library:1',
  source: 'library',
  id: 1,
  usdaId: null,
  name: 'Egg',
  brand: null,
  kcalPer100g: 143,
  macros: null,
  servingGrams: 50,
  servingLabel: '1 large',
};
const rice = {
  key: 'library:2',
  source: 'library',
  id: 2,
  usdaId: null,
  name: 'Rice, brown',
  brand: null,
  kcalPer100g: 111,
  macros: null,
  servingGrams: null,
  servingLabel: null,
};
const usdaOil = {
  key: 'usda:99',
  source: 'usda',
  fdcId: 99,
  usdaId: '99',
  name: 'Olive oil',
  brand: null,
  kcalPer100g: 884,
  macros: null,
  servingGrams: null,
  servingLabel: null,
};

describe('RECIPE_UNITS', () => {
  it('match the unit codes the server accepts', () => {
    expect([...RECIPE_UNITS]).toEqual([...SERVER_UNITS]);
  });
});

describe('gramsFor', () => {
  it('converts mass units exactly', () => {
    expect(gramsFor({ amount: 500, unit: 'g' }, null)).toEqual({
      grams: 500,
      approximate: false,
      reason: null,
    });
    expect(gramsFor({ amount: 1.5, unit: 'kg' }, null).grams).toBe(1500);
    expect(gramsFor({ amount: 1, unit: 'oz' }, null).grams).toBe(28.3);
    expect(gramsFor({ amount: 1, unit: 'lb' }, null).grams).toBe(453.6);
  });

  it('converts volume units and marks them approximate (water density)', () => {
    expect(gramsFor({ amount: 250, unit: 'ml' }, null)).toEqual({
      grams: 250,
      approximate: true,
      reason: null,
    });
    expect(gramsFor({ amount: 1, unit: 'cup' }, null)).toEqual({
      grams: 236.6,
      approximate: true,
      reason: null,
    });
    expect(gramsFor({ amount: 2, unit: 'tbsp' }, null).grams).toBe(29.6);
    expect(gramsFor({ amount: 1, unit: 'tsp' }, null).grams).toBe(4.9);
    expect(gramsFor({ amount: 0.5, unit: 'cup' }, null).grams).toBe(118.3);
  });

  it('turns a count into grams with the food per-item weight when it has one', () => {
    expect(gramsFor({ amount: 2, unit: 'each' }, eggs)).toEqual({
      grams: 100,
      approximate: false,
      reason: null,
    });
  });

  it('asks for grams when a count has no per-item weight', () => {
    expect(gramsFor({ amount: 2, unit: 'each' }, rice)).toEqual({
      grams: null,
      approximate: false,
      reason: 'serving',
    });
    expect(gramsFor({ amount: 2, unit: 'each' }, null).reason).toBe('serving');
  });

  it('asks for grams when there is no amount or no unit', () => {
    expect(gramsFor({ amount: null, unit: 'g' }, null).reason).toBe('amount');
    expect(gramsFor({ amount: 0, unit: 'g' }, null).reason).toBe('amount');
    expect(gramsFor({ amount: -3, unit: 'g' }, null).reason).toBe('amount');
    expect(gramsFor({ amount: 2, unit: null }, eggs).reason).toBe('unit');
    expect(gramsFor({ amount: 2, unit: 'pinch' }, eggs).reason).toBe('unit');
  });

  it('treats an amount that rounds to zero grams as missing', () => {
    expect(gramsFor({ amount: 0.01, unit: 'g' }, null).reason).toBe('amount');
  });
});

describe('chooseMatch', () => {
  it('is sure for a Food Library food with the same name', () => {
    const match = chooseMatch('egg', [eggs, usdaOil]);
    expect(match.status).toBe('sure');
    expect(match.food).toBe(eggs);
  });

  it('is unsure, with the first result, when only a close name matches', () => {
    const match = chooseMatch('brown rice', [rice]);
    expect(match.status).toBe('unsure');
    expect(match.food).toBe(rice);
  });

  it('is unsure for a USDA-only result, never sure', () => {
    const match = chooseMatch('olive oil', [usdaOil]);
    expect(match.status).toBe('unsure');
    expect(match.food).toBe(usdaOil);
  });

  it('is none with no results', () => {
    expect(chooseMatch('dragonfruit', [])).toEqual({ status: 'none', food: null });
  });
});

describe('row helpers', () => {
  const line = { text: '2 eggs', name: 'egg', amount: 2, unit: 'each' };

  it('a new row has no food and needs a check', () => {
    const row = newRow(line, 0);
    expect(row.food).toBeNull();
    expect(rowNeedsCheck(row)).toBe(true);
  });

  it('picking a food confirms the match and fills the grams', () => {
    const row = rowWithFood(newRow(line, 0), eggs);
    expect(row.status).toBe('sure');
    expect(row.grams).toBe('100');
    expect(rowNeedsCheck(row)).toBe(false);
  });

  it('a volume conversion still needs a check after a pick', () => {
    const row = rowWithFood(
      newRow({ text: '1 cup rice', name: 'rice', amount: 1, unit: 'cup' }, 0),
      rice
    );
    expect(row.approximate).toBe(true);
    expect(rowNeedsCheck(row)).toBe(true);
  });

  it('a count with no per-item weight leaves grams blank and needs a check', () => {
    const row = rowWithFood(newRow(line, 0), rice);
    expect(row.grams).toBe('');
    expect(row.reason).toBe('serving');
    expect(rowNeedsCheck(row)).toBe(true);
  });

  it('typed grams replace the conversion and clear the flags', () => {
    const row = rowWithGrams(rowWithFood(newRow(line, 0), rice), '90');
    expect(row.grams).toBe('90');
    expect(row.reason).toBeNull();
    expect(rowNeedsCheck(row)).toBe(false);
  });

  it('a later pick keeps the grams the Member typed', () => {
    const typed = rowWithGrams(newRow(line, 0), '77');
    const picked = rowWithFood(typed, eggs);
    expect(picked.grams).toBe('77');
  });
});

describe('canContinue', () => {
  it('needs at least one row and a food on each', () => {
    expect(canContinue([]).reason).toBe('empty');
    expect(
      canContinue([newRow({ text: 'x', name: 'x', amount: null, unit: null }, 0)]).reason
    ).toBe('noFood');
    expect(
      canContinue([
        rowWithFood(newRow({ text: 'x', name: 'x', amount: null, unit: null }, 0), eggs),
      ]).ok
    ).toBe(true);
  });
});

describe('matchRecipeLines', () => {
  const lines = [
    { text: '2 eggs', name: 'egg', amount: 2, unit: 'each' },
    { text: '1 cup brown rice', name: 'brown rice', amount: 1, unit: 'cup' },
    { text: 'mystery spice', name: 'mystery spice', amount: null, unit: null },
  ];

  it('matches every line through the search, one call each', async () => {
    const search = vi.fn(async (_client, query) => {
      if (query === 'egg') return { results: [eggs], libraryFailed: false, usdaFailed: false };
      if (query === 'brown rice')
        return { results: [rice], libraryFailed: false, usdaFailed: false };
      return { results: [], libraryFailed: false, usdaFailed: false };
    });
    const rows = await matchRecipeLines({}, lines, search);
    expect(search).toHaveBeenCalledTimes(3);
    expect(rows[0].status).toBe('sure');
    expect(rows[0].grams).toBe('100');
    expect(rows[1].status).toBe('unsure');
    expect(rows[1].approximate).toBe(true);
    expect(rows[2].food).toBeNull();
    expect(rows[2].reason).toBeNull();
    expect(rowNeedsCheck(rows[2])).toBe(true);
  });

  it('keeps going when one search throws, and marks that row', async () => {
    const search = vi.fn(async (_client, query) => {
      if (query === 'egg') throw new Error('network');
      return { results: [], libraryFailed: false, usdaFailed: false };
    });
    const rows = await matchRecipeLines({}, lines.slice(0, 1), search);
    expect(rows[0].searchFailed).toBe(true);
    expect(rowNeedsCheck(rows[0])).toBe(true);
  });

  it('marks a search where both sources failed', async () => {
    const search = async () => ({ results: [], libraryFailed: true, usdaFailed: true });
    const rows = await matchRecipeLines({}, lines.slice(0, 1), search);
    expect(rows[0].searchFailed).toBe(true);
  });
});

describe('searchCandidates', () => {
  it('replaces the candidates and keeps the chosen food', async () => {
    const row = rowWithFood(
      newRow({ text: 'egg', name: 'egg', amount: null, unit: null }, 0),
      eggs
    );
    const search = async () => ({ results: [usdaOil], libraryFailed: false, usdaFailed: false });
    const next = await searchCandidates({}, row, 'oil', search);
    expect(next.candidates).toEqual([usdaOil]);
    expect(next.food).toBe(eggs);
    expect(next.query).toBe('oil');
  });

  it('a blank query clears the candidates without searching', async () => {
    const search = vi.fn();
    const next = await searchCandidates(
      {},
      newRow({ text: 'x', name: 'x', amount: null, unit: null }, 0),
      '  ',
      search
    );
    expect(search).not.toHaveBeenCalled();
    expect(next.candidates).toEqual([]);
  });
});

describe('draftFromParsed', () => {
  it('makes an editor draft with no id and nothing saved', () => {
    const draft = draftFromParsed(
      { name: 'Chili', servings: 4, notes: 'Freezes well', ingredients: [] },
      [{ key: 'k', id: null, food: eggs, grams: '100' }]
    );
    expect(draft.id).toBeNull();
    expect(draft.name).toBe('Chili');
    expect(draft.servings).toBe('4');
    expect(draft.notes).toBe('Freezes well');
    expect(draft.ingredients).toHaveLength(1);
  });

  it('leaves servings blank when the text did not say', () => {
    expect(draftFromParsed({ name: 'X', servings: null, notes: null }, []).servings).toBe('');
  });
});

describe('resolveIngredients', () => {
  function fakeClient(rowsById) {
    return {
      from: () => ({
        select: () => ({
          in: async (_column, ids) => ({
            data: ids.map((id) => rowsById[id]).filter(Boolean),
            error: null,
          }),
        }),
      }),
    };
  }

  const rawEgg = { id: 1, name: 'Egg', brand: null, kcal_per_100g: 143, protein_g: 12.6 };
  const rawOil = { id: 77, name: 'Olive oil', brand: null, kcal_per_100g: 884 };

  it('reads the Food Library rows and saves a picked USDA food first', async () => {
    const save = vi.fn(async () => 77);
    const rows = [
      rowWithFood(newRow({ text: '2 eggs', name: 'egg', amount: 2, unit: 'each' }, 0), eggs),
      {
        ...rowWithFood(
          newRow({ text: '1 tbsp olive oil', name: 'olive oil', amount: 1, unit: 'tbsp' }, 1),
          usdaOil
        ),
        grams: '14.8',
      },
    ];
    const ingredients = await resolveIngredients(fakeClient({ 1: rawEgg, 77: rawOil }), rows, save);
    expect(save).toHaveBeenCalledWith(expect.anything(), 99);
    expect(ingredients.map((item) => item.food.id)).toEqual([1, 77]);
    expect(ingredients[0].food.kcal_per_100g).toBe(143);
    expect(ingredients[0].grams).toBe('100');
    expect(ingredients[1].grams).toBe('14.8');
  });

  it('throws when a row has no food', async () => {
    const rows = [newRow({ text: 'x', name: 'x', amount: null, unit: null }, 0)];
    await expect(resolveIngredients(fakeClient({}), rows, vi.fn())).rejects.toThrow();
  });
});

describe('parseRecipeText', () => {
  it('returns the reply fields from the Edge Function', async () => {
    const client = {
      functions: {
        invoke: vi.fn(async () => ({
          data: {
            name: 'Chili',
            servings: 4,
            notes: null,
            ingredients: [{ text: 'salt', name: 'salt', amount: null, unit: null }],
          },
          error: null,
        })),
      },
    };
    const parsed = await parseRecipeText(client, 'Chili for four');
    expect(client.functions.invoke).toHaveBeenCalledWith('parse-recipe', {
      body: { text: 'Chili for four' },
    });
    expect(parsed.name).toBe('Chili');
    expect(parsed.ingredients).toHaveLength(1);
  });

  it('maps a refusal over the AI cap to the cap code', async () => {
    const client = {
      functions: {
        invoke: async () => ({
          data: null,
          error: { context: { json: async () => ({ code: 'AI_LIMIT_REACHED' }) } },
        }),
      },
    };
    await expect(parseRecipeText(client, 'x')).rejects.toMatchObject({ code: 'cap' });
  });

  it('maps any other failure, or an odd reply, to failed', async () => {
    const failing = {
      functions: { invoke: async () => ({ data: null, error: { context: null } }) },
    };
    await expect(parseRecipeText(failing, 'x')).rejects.toBeInstanceOf(PasteError);
    await expect(parseRecipeText(failing, 'x')).rejects.toMatchObject({ code: 'failed' });

    const odd = { functions: { invoke: async () => ({ data: { name: 'x' }, error: null }) } };
    await expect(parseRecipeText(odd, 'x')).rejects.toMatchObject({ code: 'failed' });

    const throws = {
      functions: {
        invoke: async () => {
          throw new Error('offline');
        },
      },
    };
    await expect(parseRecipeText(throws, 'x')).rejects.toMatchObject({ code: 'failed' });
  });
});
