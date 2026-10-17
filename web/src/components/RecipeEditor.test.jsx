import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecipeEditor from './RecipeEditor.jsx';
import {
  copyRecipe,
  deleteRecipe,
  loadMealTimeOptions,
  saveRecipe,
  searchFoods,
} from '../lib/recipes.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

vi.mock('../lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../lib/recipes.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadRecipes: vi.fn(),
  loadMealTimeOptions: vi.fn(),
  saveRecipe: vi.fn(),
  copyRecipe: vi.fn(),
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

const existing = {
  id: 5,
  name: 'Fried rice',
  starred: false,
  servings: 2,
  cooked_weight_g: null,
  notes: 'Day-old rice',
  ingredients: [{ id: 11, grams: 200, food: rice }],
};

function renderEditor(props = {}) {
  const onClose = vi.fn();
  render(<RecipeEditor recipe={null} onClose={onClose} {...props} />, {
    wrapper: I18nProvider,
  });
  return { onClose };
}

// Types a Food Library search, then adds the first result as an ingredient.
async function addFood(name) {
  searchFoods.mockResolvedValue([rice]);
  await userEvent.type(screen.getByLabelText('Find a food in the Food Library'), name);
  await userEvent.click(await screen.findByRole('button', { name: `Add ${rice.name}` }));
}

const breakfast = { id: 1, name: 'Breakfast' };
const dinner = { id: 2, name: 'Dinner' };

describe('RecipeEditor', () => {
  beforeEach(() => {
    saveRecipe.mockResolvedValue(9);
    copyRecipe.mockResolvedValue(20);
    deleteRecipe.mockResolvedValue();
    searchFoods.mockResolvedValue([]);
    loadMealTimeOptions.mockResolvedValue([breakfast, dinner]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the per-serving totals as ingredients are added and weighed', async () => {
    renderEditor();
    await userEvent.clear(screen.getByLabelText('Makes how many servings'));
    await userEvent.type(screen.getByLabelText('Makes how many servings'), '2');

    await addFood('ri');
    await userEvent.type(screen.getByLabelText('Grams of Rice'), '200');

    // 200 g of rice is 260 kcal, shared over 2 servings.
    expect(await screen.findByText('130 kcal')).toBeInTheDocument();
    expect(screen.getByText('Total weight of the ingredients: 200 g')).toBeInTheDocument();
  });

  it('sets the grams in one serving from the cooked weight', async () => {
    renderEditor();
    await userEvent.clear(screen.getByLabelText('Makes how many servings'));
    await userEvent.type(screen.getByLabelText('Makes how many servings'), '4');
    await userEvent.type(screen.getByLabelText('Cooked weight (g), optional'), '1200');

    expect(screen.getByText('About 300 g per serving')).toBeInTheDocument();
  });

  it('refuses to save with no name and no ingredients, and does not call the database', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Save Recipe' }));

    expect(await screen.findByText('Give the Recipe a name.')).toBeInTheDocument();
    expect(screen.getByText('Add at least one ingredient.')).toBeInTheDocument();
    expect(saveRecipe).not.toHaveBeenCalled();
  });

  it('saves a new Recipe with its ingredients in grams, then closes with changed', async () => {
    const { onClose } = renderEditor();

    await userEvent.type(screen.getByLabelText('Name'), '  Egg fried rice ');
    await userEvent.clear(screen.getByLabelText('Makes how many servings'));
    await userEvent.type(screen.getByLabelText('Makes how many servings'), '2');
    await userEvent.type(screen.getByLabelText('Notes'), 'Use day-old rice.');
    await addFood('ri');
    await userEvent.type(screen.getByLabelText('Grams of Rice'), '200');
    await userEvent.click(screen.getByRole('button', { name: 'Save Recipe' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(saveRecipe).toHaveBeenCalledWith(expect.anything(), {
      id: null,
      name: 'Egg fried rice',
      starred: false,
      servings: 2,
      cookedWeightG: null,
      notes: 'Use day-old rice.',
      mealTimeIds: [],
      ingredients: [{ foodId: 7, grams: 200 }],
    });
  });

  it('saves the Meal Times ticked as tags, as a hint', async () => {
    const { onClose } = renderEditor({ recipe: existing });
    await screen.findByLabelText('Dinner');

    await userEvent.click(screen.getByLabelText('Dinner'));
    await userEvent.click(screen.getByRole('button', { name: 'Save Recipe' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(saveRecipe.mock.calls[0][1].mealTimeIds).toEqual([2]);
  });

  it('keeps a tag whose Meal Time the Member cannot see, and says so', async () => {
    const { onClose } = renderEditor({
      recipe: {
        ...existing,
        meal_time_tags: [{ id: 7, name: null }],
      },
    });

    expect(await screen.findByLabelText('a Meal Time you cannot see')).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Save Recipe' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(saveRecipe.mock.calls[0][1].mealTimeIds).toEqual([7]);
  });

  it('copies the saved Recipe as a variation, then closes with changed', async () => {
    const { onClose } = renderEditor({ recipe: existing });

    await userEvent.click(screen.getByRole('button', { name: 'Copy as a variation' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(copyRecipe).toHaveBeenCalledWith(expect.anything(), 5, 'Fried rice (variation)');
    expect(saveRecipe).not.toHaveBeenCalled();
  });

  it('shows the copy error and stays open when copying fails', async () => {
    copyRecipe.mockRejectedValue(new Error('network'));
    const { onClose } = renderEditor({ recipe: existing });

    await userEvent.click(screen.getByRole('button', { name: 'Copy as a variation' }));

    expect(await screen.findByText('Could not copy the Recipe. Try again.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('names the original of a copy', () => {
    renderEditor({ recipe: { ...existing, copied_from: 3 }, originalName: 'Fried rice' });
    expect(screen.getByText('Variation of Fried rice')).toBeInTheDocument();
  });

  it('does not offer a copy for a new Recipe', () => {
    renderEditor();
    expect(screen.queryByRole('button', { name: 'Copy as a variation' })).not.toBeInTheDocument();
  });

  it('shows the save error and stays open when saving fails', async () => {
    saveRecipe.mockRejectedValue(new Error('network'));
    const { onClose } = renderEditor({ recipe: existing });

    await userEvent.click(screen.getByRole('button', { name: 'Save Recipe' }));

    expect(await screen.findByText('Could not save the Recipe. Try again.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('loads an existing Recipe and saves it under its id', async () => {
    const { onClose } = renderEditor({ recipe: existing });
    expect(screen.getByLabelText('Name')).toHaveValue('Fried rice');
    expect(screen.getByLabelText('Notes')).toHaveValue('Day-old rice');

    await userEvent.click(screen.getByRole('button', { name: 'Save Recipe' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(saveRecipe.mock.calls[0][1]).toMatchObject({
      id: 5,
      servings: 2,
      ingredients: [{ foodId: 7, grams: 200 }],
    });
  });

  it('deletes only after a second confirmation', async () => {
    const { onClose } = renderEditor({ recipe: existing });

    await userEvent.click(screen.getByRole('button', { name: 'Delete Recipe' }));
    expect(deleteRecipe).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(deleteRecipe).toHaveBeenCalledWith(expect.anything(), 5);
  });

  it('does not offer delete for a new Recipe', () => {
    renderEditor();
    expect(screen.queryByRole('button', { name: 'Delete Recipe' })).not.toBeInTheDocument();
  });

  it('closes without changes when cancelled', async () => {
    const { onClose } = renderEditor({ recipe: existing });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledWith(false);
    expect(saveRecipe).not.toHaveBeenCalled();
  });
});
