import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import PantryPage from './PantryPage.jsx';
import { supabase } from '../lib/supabase.js';
import { MetricProvider } from '../test/metricUnits.jsx';

vi.mock('../lib/supabase.js', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));

const riceFood = {
  id: 5,
  name: 'Rice, white',
  brand: null,
  source: 'label',
  source_id: null,
  kcal_per_100g: 365,
  servings: null,
  protein_g: 7,
  carbs_g: 80,
  fat_g: 0.6,
  fibre_g: 1.3,
  sugars_g: 0,
  sodium_mg: 5,
};

// Pantry rows as the database returns them (with the joined food). `pantry` is mutated the
// way the pantry_add and pantry_correct functions would change it.
function fakeBackend(initial = []) {
  const pantry = initial.map((row) => ({ ...row }));
  supabase.from.mockImplementation((table) => {
    if (table === 'pantry_items') {
      return {
        select: () => ({
          order: async () => ({ data: pantry.map((row) => ({ ...row })), error: null }),
        }),
      };
    }
    // The Food Library search (foods)
    const chain = {
      select: () => chain,
      order: () => chain,
      limit: async () => ({ data: [riceFood], error: null }),
    };
    return chain;
  });
  supabase.rpc.mockImplementation(async (name, args) => {
    if (name === 'usda_search') return { data: [], error: null };
    if (name === 'pantry_add') {
      const existing = pantry.find((row) => row.food_id === args.p_food_id);
      if (existing) existing.grams += args.p_grams;
      else
        pantry.push({
          id: pantry.length + 1,
          food_id: args.p_food_id,
          grams: args.p_grams,
          foods: { name: riceFood.name, brand: null, store_section: 'Pantry' },
        });
      return { data: 1, error: null };
    }
    if (name === 'pantry_correct') {
      const row = pantry.find((candidate) => candidate.id === args.p_item_id);
      if (args.p_action === 'used_up') row.grams = 0;
      if (args.p_action === 'half') row.grams = row.grams / 2;
      if (args.p_action === 'set') row.grams = args.p_grams;
      return { data: row.grams, error: null };
    }
    return { data: null, error: null };
  });
  return { pantry };
}

const milk = {
  id: 1,
  food_id: 11,
  grams: 500,
  foods: { name: 'Milk, whole', brand: null, store_section: 'Dairy & eggs' },
};
const carrot = {
  id: 2,
  food_id: 12,
  grams: 200,
  foods: { name: 'Carrot', brand: null, store_section: 'Produce' },
};

function renderScreen() {
  return render(<PantryPage />, { wrapper: MetricProvider });
}

describe('PantryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  // Vitest runs without globals here, so Testing Library does not clean up on its own.
  afterEach(() => {
    cleanup();
  });

  it('says the Pantry is empty and shows the add form when nothing is held', async () => {
    fakeBackend([]);
    renderScreen();

    expect(screen.getByRole('heading', { name: 'Pantry' })).toBeInTheDocument();
    expect(await screen.findByText(/Nothing in the Pantry yet/)).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search foods to add' })).toBeInTheDocument();
  });

  it('groups the items by store section, in shopping order, with amounts in grams', async () => {
    fakeBackend([milk, carrot]);
    renderScreen();

    expect(await screen.findByText('Carrot')).toBeInTheDocument();
    const headings = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(['Add to the Pantry', 'Produce', 'Dairy & eggs']);
    expect(screen.getByText('200 g')).toBeInTheDocument();
    expect(screen.getByText('500 g')).toBeInTheDocument();
  });

  it('adds a searched food with its grams and shows it in the Pantry', async () => {
    const { pantry } = fakeBackend([]);
    renderScreen();
    await screen.findByText(/Nothing in the Pantry yet/);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search foods to add' }), 'rice');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByRole('heading', { name: 'Rice, white' });
    await userEvent.type(screen.getByRole('textbox', { name: 'Amount of Rice, white (g)' }), '50');
    await userEvent.click(screen.getByRole('button', { name: 'Add Rice, white' }));

    expect(supabase.rpc).toHaveBeenCalledWith('pantry_add', { p_food_id: 5, p_grams: 50 });
    expect(await screen.findByText('50 g')).toBeInTheDocument();
    expect(pantry).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Added Rice, white to the Pantry.');
  });

  it('refuses an amount that is not grams and calls nothing', async () => {
    fakeBackend([]);
    renderScreen();
    await screen.findByText(/Nothing in the Pantry yet/);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search foods to add' }), 'rice');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByRole('heading', { name: 'Rice, white' });
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Amount of Rice, white (g)' }),
      'lots'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add Rice, white' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Type an amount, such as 150/);
    expect(supabase.rpc).not.toHaveBeenCalledWith('pantry_add', expect.anything());
  });

  it('"used up" sets the item to zero, and it disappears from the list', async () => {
    fakeBackend([carrot]);
    renderScreen();
    await screen.findByText('Carrot');

    await userEvent.click(screen.getByRole('button', { name: 'Used up' }));

    expect(supabase.rpc).toHaveBeenCalledWith('pantry_correct', {
      p_item_id: 2,
      p_action: 'used_up',
      p_grams: null,
    });
    await screen.findByText(/Nothing in the Pantry yet/);
    expect(screen.queryByText('Carrot')).not.toBeInTheDocument();
  });

  it('"about half" halves the amount', async () => {
    fakeBackend([carrot]);
    renderScreen();
    await screen.findByText('Carrot');

    await userEvent.click(screen.getByRole('button', { name: 'About half' }));

    expect(supabase.rpc).toHaveBeenCalledWith('pantry_correct', {
      p_item_id: 2,
      p_action: 'half',
      p_grams: null,
    });
    expect(await screen.findByText('100 g')).toBeInTheDocument();
  });

  it('a typed amount replaces the amount, with a comma accepted as the decimal mark', async () => {
    fakeBackend([carrot]);
    renderScreen();
    await screen.findByText('Carrot');

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Type the amount of Carrot left (g)' }),
      '62,5'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Set amount' }));

    expect(supabase.rpc).toHaveBeenCalledWith('pantry_correct', {
      p_item_id: 2,
      p_action: 'set',
      p_grams: 62.5,
    });
    expect(await screen.findByText('62.5 g')).toBeInTheDocument();
  });

  it('shows the list as a grouped set of items for each section', async () => {
    fakeBackend([milk, carrot]);
    renderScreen();
    await screen.findByText('Carrot');

    const produce = screen.getByRole('heading', { name: 'Produce' }).parentElement;
    expect(within(produce).getByText('Carrot')).toBeInTheDocument();
    expect(within(produce).queryByText('Milk, whole')).not.toBeInTheDocument();
  });
});
