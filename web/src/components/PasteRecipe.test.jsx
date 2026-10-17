import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PasteRecipe from './PasteRecipe.jsx';
import { supabase } from '../lib/supabase.js';
import { saveUsdaFood, searchFoods } from '../lib/foods.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';
import recorded from '../test/recorded/paste-recipe-chili.json';

vi.mock('../lib/supabase.js', () => ({
  supabase: { functions: { invoke: vi.fn() }, from: vi.fn() },
}));
vi.mock('../lib/foods.js', async (importOriginal) => ({
  ...(await importOriginal()),
  searchFoods: vi.fn(),
  saveUsdaFood: vi.fn(),
}));

// The recorded reply's JSON, as the Edge Function returns it to the app.
const recordedRecipe = JSON.parse(recorded.content[0].text);

const libraryFood = (id, name, kcal, servingGrams = null) => ({
  key: `library:${id}`,
  source: 'library',
  id,
  usdaId: null,
  name,
  brand: null,
  kcalPer100g: kcal,
  macros: null,
  servingGrams,
  servingLabel: null,
});
const usdaFood = (fdcId, name, kcal) => ({
  key: `usda:${fdcId}`,
  source: 'usda',
  fdcId,
  usdaId: String(fdcId),
  name,
  brand: null,
  kcalPer100g: kcal,
  macros: null,
  servingGrams: null,
  servingLabel: null,
});

// What each ingredient name finds, in the order searchFoods returns (library first).
const foundFor = {
  'black beans, dry': [usdaFood(5, 'Black beans, dry', 341)],
  eggs: [libraryFood(1, 'Egg', 143, 50)],
  'olive oil': [libraryFood(2, 'Olive oil', 884)],
  cumin: [],
  'ground beef': [libraryFood(3, 'Ground beef', 254)],
  salt: [],
};

// The Food Library rows the editor reads back for the chosen foods.
const rawFoods = [
  {
    id: 1,
    name: 'Egg',
    brand: null,
    kcal_per_100g: 143,
    protein_g: 12.6,
    carbs_g: 0.7,
    fat_g: 9.5,
    fibre_g: 0,
    sugars_g: 0.4,
    sodium_mg: 124,
  },
  {
    id: 2,
    name: 'Olive oil',
    brand: null,
    kcal_per_100g: 884,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 100,
    fibre_g: 0,
    sugars_g: 0,
    sodium_mg: 2,
  },
  {
    id: 3,
    name: 'Ground beef',
    brand: null,
    kcal_per_100g: 254,
    protein_g: 17,
    carbs_g: 0,
    fat_g: 20,
    fibre_g: 0,
    sugars_g: 0,
    sodium_mg: 66,
  },
  {
    id: 55,
    name: 'Black beans, dry',
    brand: null,
    kcal_per_100g: 341,
    protein_g: 21.6,
    carbs_g: 62.4,
    fat_g: 1.4,
    fibre_g: 15.5,
    sugars_g: 2.1,
    sodium_mg: 2,
  },
];

function renderPaste(props = {}) {
  const handlers = { onDone: vi.fn(), onManual: vi.fn(), onCancel: vi.fn(), ...props };
  render(<PasteRecipe {...handlers} />, { wrapper: I18nProvider });
  return handlers;
}

beforeEach(() => {
  supabase.functions.invoke.mockReset();
  supabase.functions.invoke.mockResolvedValue({ data: recordedRecipe, error: null });
  supabase.from.mockReset();
  supabase.from.mockImplementation(() => ({
    select: () => ({
      in: async (_column, ids) => ({
        data: rawFoods.filter((food) => ids.includes(food.id)),
        error: null,
      }),
    }),
  }));
  searchFoods.mockReset();
  searchFoods.mockImplementation(async (_client, query) => ({
    results: foundFor[query] ?? [],
    libraryFailed: false,
    usdaFailed: false,
  }));
  saveUsdaFood.mockReset();
  saveUsdaFood.mockResolvedValue(55);
});

afterEach(() => {
  cleanup();
});

describe('Paste a Recipe', () => {
  it('reads the text, pre-fills the review and flags the lines that need a look', async () => {
    renderPaste();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Recipe text'), 'Quick Bean Chili for four');
    await user.click(screen.getByRole('button', { name: 'Read the recipe' }));

    expect(await screen.findByRole('heading', { name: 'Check the matches' })).toBeInTheDocument();
    expect(supabase.functions.invoke).toHaveBeenCalledWith('parse-recipe', {
      body: { text: 'Quick Bean Chili for four' },
    });
    expect(screen.getByLabelText('Name')).toHaveValue('Quick Bean Chili');
    expect(screen.getByLabelText('Makes how many servings')).toHaveValue('4');

    // Ground beef is a sure match with exact grams: no flag. Eggs are a guess: flagged.
    const rows = screen.getAllByRole('listitem');
    const rowFor = (text) => rows.find((row) => within(row).queryByText(text));
    expect(rowFor('500 g ground beef')).toHaveAttribute('data-needs-check', 'false');
    expect(rowFor('2 eggs')).toHaveAttribute('data-needs-check', 'true');
    expect(within(rowFor('2 eggs')).getByText('Check this')).toBeInTheDocument();
    expect(
      within(rowFor('2 eggs')).getByText('This is a guess. Pick the right food.')
    ).toBeInTheDocument();
    expect(
      within(rowFor('1 cup dry black beans, rinsed')).getByText(/as if it were water/)
    ).toBeInTheDocument();
  });

  it('keeps the Recipe unsaved and opens the editor only when the Member continues', async () => {
    const { onDone } = renderPaste();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Recipe text'), 'Chili');
    await user.click(screen.getByRole('button', { name: 'Read the recipe' }));
    await screen.findByRole('heading', { name: 'Check the matches' });

    // Cumin and salt have no match: they are removed, and Continue needs a food per line.
    await user.click(screen.getByRole('button', { name: 'Remove cumin' }));
    await user.click(screen.getByRole('button', { name: 'Remove salt' }));
    expect(onDone).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Continue to the Recipe' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));

    const draft = onDone.mock.calls[0][0];
    expect(draft.id).toBeNull();
    expect(draft.name).toBe('Quick Bean Chili');
    expect(draft.servings).toBe('4');
    expect(draft.ingredients.map((item) => [item.food.name, item.grams])).toEqual([
      ['Black beans, dry', '236.6'],
      ['Egg', '100'],
      ['Olive oil', '29.6'],
      ['Ground beef', '500'],
    ]);
    // Nutrition comes from the Food Library row, not from the AI.
    expect(draft.ingredients[1].food.kcal_per_100g).toBe(143);
    // The USDA food was saved only because the Member continued with it.
    expect(saveUsdaFood).toHaveBeenCalledWith(supabase, 5);
    // No write to the Recipes tables happened on the way.
    const tables = supabase.from.mock.calls.map(([table]) => table);
    expect(tables.every((table) => table === 'foods')).toBe(true);
  });

  it('keeps the grams the Member types over the conversion', async () => {
    const { onDone } = renderPaste();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Recipe text'), 'Chili');
    await user.click(screen.getByRole('button', { name: 'Read the recipe' }));
    await screen.findByRole('heading', { name: 'Check the matches' });
    await user.click(screen.getByRole('button', { name: 'Remove cumin' }));
    await user.click(screen.getByRole('button', { name: 'Remove salt' }));

    const grams = screen.getByLabelText('Grams of eggs');
    await user.clear(grams);
    await user.type(grams, '90');
    expect(grams).toHaveValue('90');

    await user.click(screen.getByRole('button', { name: 'Continue to the Recipe' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    const egg = onDone.mock.calls[0][0].ingredients.find((item) => item.food.name === 'Egg');
    expect(egg.grams).toBe('90');
  });

  it('shows the AI cap message and keeps manual entry working', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { context: { json: async () => ({ code: 'AI_LIMIT_REACHED' }) } },
    });
    const { onManual } = renderPaste();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Recipe text'), 'Chili');
    await user.click(screen.getByRole('button', { name: 'Read the recipe' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('AI limit reached this month');
    await user.click(screen.getByRole('button', { name: 'Enter the Recipe by hand instead' }));
    expect(onManual).toHaveBeenCalledTimes(1);
  });

  it('asks for text before calling the AI', async () => {
    renderPaste();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Read the recipe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Paste the recipe text first.');
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('offers to try again after a failed read', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: null, error: { context: null } });
    renderPaste();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Recipe text'), 'Chili');
    await user.click(screen.getByRole('button', { name: 'Read the recipe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not read the recipe.');
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });
});
