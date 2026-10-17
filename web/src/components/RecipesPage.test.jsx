import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecipesPage from './RecipesPage.jsx';
import { loadRecipes, saveRecipe, deleteRecipe, searchFoods } from '../lib/recipes.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

vi.mock('../lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../lib/recipes.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadRecipes: vi.fn(),
  saveRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
  searchFoods: vi.fn(),
}));

const rice = {
  id: 7,
  name: 'Rice',
  brand: null,
  kcal_per_100g: 130,
  protein_g: 2.7,
  carbs_g: 28,
  fat_g: 0.3,
  fibre_g: 0.4,
  sugars_g: 0.1,
  sodium_mg: 1,
};

// Chili: 200 g of rice is 260 kcal, shared over 4 servings is 65 kcal each.
const chili = {
  id: 1,
  name: 'Chili',
  starred: true,
  servings: 4,
  cooked_weight_g: null,
  notes: null,
  ingredients: [{ id: 11, grams: 200, food: rice }],
};
const toast = {
  id: 2,
  name: 'Toast',
  starred: false,
  servings: 1,
  cooked_weight_g: null,
  notes: null,
  ingredients: [],
};

function renderPage() {
  return render(<RecipesPage />, { wrapper: I18nProvider });
}

describe('RecipesPage', () => {
  beforeEach(() => {
    loadRecipes.mockResolvedValue([chili, toast]);
    saveRecipe.mockResolvedValue(3);
    deleteRecipe.mockResolvedValue();
    searchFoods.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('lists the Recipes with servings and calories per serving', async () => {
    renderPage();

    expect(await screen.findByRole('button', { name: /Chili/ })).toBeInTheDocument();
    expect(screen.getByText('Makes 4 servings · 65 kcal per serving')).toBeInTheDocument();
    expect(screen.getByText('Makes 1 servings · 0 kcal per serving')).toBeInTheDocument();
    expect(screen.getByLabelText('Starred')).toBeInTheDocument();
  });

  it('shows calories as Unknown when an ingredient food has no calorie value', async () => {
    const noCalories = { ...rice, kcal_per_100g: null };
    loadRecipes.mockResolvedValue([
      { ...chili, ingredients: [{ id: 12, grams: 100, food: noCalories }] },
    ]);
    renderPage();
    expect(await screen.findByText('Makes 4 servings · Unknown')).toBeInTheDocument();
  });

  it('filters the list by the name typed, ignoring case and accents', async () => {
    renderPage();
    await screen.findByRole('button', { name: /Chili/ });

    await userEvent.type(screen.getByLabelText('Search Recipes'), 'TOA');

    expect(screen.queryByRole('button', { name: /Chili/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Toast/ })).toBeInTheDocument();
  });

  it('says so when no Recipe matches the search', async () => {
    renderPage();
    await screen.findByRole('button', { name: /Chili/ });

    await userEvent.type(screen.getByLabelText('Search Recipes'), 'zzz');

    expect(screen.getByText('No Recipes match that search.')).toBeInTheDocument();
  });

  it('shows the empty state when the Household has no Recipes', async () => {
    loadRecipes.mockResolvedValue([]);
    renderPage();
    expect(
      await screen.findByText('No Recipes yet. Add your first one below.')
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Search Recipes')).not.toBeInTheDocument();
  });

  it('shows an error when the Recipes cannot be loaded', async () => {
    loadRecipes.mockRejectedValue(new Error('offline'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your Recipes.');
  });

  it('opens the editor for a new Recipe, and goes back to the list', async () => {
    renderPage();
    await screen.findByRole('button', { name: /Chili/ });

    await userEvent.click(screen.getByRole('button', { name: 'Add a Recipe' }));
    expect(screen.getByRole('heading', { name: 'New Recipe' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Back to Recipes' }));
    expect(await screen.findByRole('button', { name: /Chili/ })).toBeInTheDocument();
  });

  it('opens an existing Recipe in the editor', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Chili/ }));

    expect(screen.getByRole('heading', { name: 'Edit Recipe' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Chili');
    expect(
      within(screen.getByRole('region', { name: 'Per serving' })).getByText('65 kcal')
    ).toBeInTheDocument();
  });

  it('reloads the list after a Recipe is saved', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Chili/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save Recipe' }));

    await waitFor(() => expect(loadRecipes).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: /Chili/ })).toBeInTheDocument();
  });
});
