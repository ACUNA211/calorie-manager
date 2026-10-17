import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import FoodsPage from './FoodsPage.jsx';
import { supabase } from '../lib/supabase.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

vi.mock('../lib/supabase.js', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));

const libraryRow = {
  id: 1,
  name: 'Jalapeño, pickled',
  brand: null,
  source: 'label',
  source_id: null,
  kcal_per_100g: 20,
  servings: [{ label: '1 jar', grams: 50 }],
  protein_g: 0.5,
  carbs_g: 4,
  fat_g: 0.1,
  fibre_g: null,
  sugars_g: 2,
  sodium_mg: 900,
};

const oatFlakes = { ...libraryRow, id: 2, name: 'Oat flakes', source: 'label', source_id: null };

const usdaHit = {
  fdc_id: 2345,
  name: 'Oats, rolled',
  brand: null,
  kcal_per_100g: 379,
  serving_g: 40,
  serving_label: '0.5 cup',
};

// The Food Library table and the USDA function. `library` is mutable so a save can add a
// row, as the database would.
function fakeBackend({
  library = [libraryRow, oatFlakes],
  usdaHits = [usdaHit],
  usdaError,
  saveError,
} = {}) {
  const rows = [...library];
  const chain = {
    select: () => chain,
    order: () => chain,
    limit: async () => ({ data: [...rows], error: null }),
  };
  supabase.from.mockImplementation(() => chain);
  supabase.rpc.mockImplementation(async (name) => {
    if (name === 'usda_search') {
      return usdaError ? { data: null, error: new Error('down') } : { data: usdaHits, error: null };
    }
    if (name === 'usda_save') {
      if (saveError) return { data: null, error: new Error('no') };
      rows.push({
        ...libraryRow,
        id: 99,
        name: 'Oats, rolled',
        source: 'usda',
        source_id: '2345',
        kcal_per_100g: 379,
        servings: [{ label: '0.5 cup', grams: 40 }],
        protein_g: 13.2,
        carbs_g: 67.7,
        fat_g: 6.5,
        fibre_g: 10.1,
        sugars_g: 0,
        sodium_mg: 2,
      });
      return { data: 99, error: null };
    }
    return { data: null, error: null };
  });
  return { rows };
}

function renderScreen() {
  return render(<FoodsPage />, { wrapper: I18nProvider });
}

async function typeQuery(text, label = 'Search foods') {
  await userEvent.type(screen.getByRole('searchbox', { name: label }), text);
}

describe('FoodsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  // Vitest runs without globals here, so Testing Library does not clean up on its own.
  afterEach(() => {
    cleanup();
  });

  it('asks the person to type before anything is searched', () => {
    fakeBackend();

    renderScreen();

    expect(screen.getByRole('heading', { name: 'Foods' })).toBeInTheDocument();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('lists Food Library matches first, then USDA results', async () => {
    fakeBackend();
    renderScreen();

    await typeQuery('oat');

    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByRole('heading', { name: 'Oat flakes' })).toBeInTheDocument();
    expect(within(items[0]).getByText('In your Food Library')).toBeInTheDocument();
    expect(within(items[1]).getByRole('heading', { name: 'Oats, rolled' })).toBeInTheDocument();
    expect(within(items[1]).getByText('USDA')).toBeInTheDocument();
    expect(supabase.rpc).toHaveBeenCalledWith('usda_search', {
      p_query: 'oat',
      p_page_size: 12,
    });
  });

  it('finds a library food when the search has no accent and different case', async () => {
    fakeBackend();
    renderScreen();

    await typeQuery('JALAPENO');

    const item = (await screen.findAllByRole('listitem'))[0];
    expect(within(item).getByRole('heading', { name: /Jalapeño, pickled/ })).toBeInTheDocument();
    expect(within(item).getByText('In your Food Library')).toBeInTheDocument();
    const table = within(item).getByRole('table');
    expect(within(table).getByRole('row', { name: /Calories 20 kcal/ })).toBeInTheDocument();
  });

  it('shows the per-serving column and the serving line for a food with a serving', async () => {
    fakeBackend();
    renderScreen();

    await typeQuery('jalapeno');

    const item = (await screen.findAllByRole('listitem'))[0];
    const table = within(item).getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Per serving' })).toBeInTheDocument();
    // 20 kcal per 100 g on a 50 g serving is 10 kcal.
    expect(
      within(table).getByRole('row', { name: /Calories 20 kcal 10 kcal/ })
    ).toBeInTheDocument();
    expect(within(item).getByText('Serving: 1 jar (50 g)')).toBeInTheDocument();
  });

  it('shows calories only for a USDA result, and saving it adds it to the Food Library once', async () => {
    const { rows } = fakeBackend();
    renderScreen();

    await typeQuery('oats');

    // The Food Library match (Oat flakes) comes first; the USDA result is second.
    const item = (await screen.findAllByRole('listitem'))[1];
    expect(within(item).getByText('USDA')).toBeInTheDocument();
    expect(
      within(item).getByText('Protein, carbs and fat show after you save this food.')
    ).toBeInTheDocument();
    await userEvent.click(within(item).getByRole('button', { name: 'Save to Food Library' }));

    expect(await screen.findByText('Saved to your Food Library.')).toBeInTheDocument();
    expect(supabase.rpc).toHaveBeenCalledWith('usda_save', { p_fdc_id: 2345 });
    expect(rows).toHaveLength(3);
    // The refreshed search lists the saved food once, from the Food Library (no USDA copy).
    expect(await screen.findAllByText('In your Food Library')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Save to Food Library' })).toBeNull();
  });

  it('keeps the Food Library results and says so when USDA fails', async () => {
    fakeBackend({ usdaError: true });
    renderScreen();

    await typeQuery('jalapeno');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not search USDA. Your Food Library results are shown.'
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('says when a save fails and keeps the button', async () => {
    fakeBackend({ saveError: true });
    renderScreen();

    await typeQuery('oats');
    const item = (await screen.findAllByRole('listitem'))[1];
    await userEvent.click(within(item).getByRole('button', { name: 'Save to Food Library' }));

    expect(await within(item).findByRole('alert')).toHaveTextContent(
      'Could not save this food. Try again.'
    );
    expect(within(item).getByRole('button', { name: 'Save to Food Library' })).toBeEnabled();
  });

  it('shows the screen in Spanish', async () => {
    window.localStorage.setItem('calorieManager.locale', 'es');
    fakeBackend();
    renderScreen();

    expect(screen.getByRole('heading', { name: 'Alimentos' })).toBeInTheDocument();
    await typeQuery('oats', 'Buscar alimentos');
    const item = (await screen.findAllByRole('listitem'))[1];
    expect(
      within(item).getByRole('button', { name: 'Guardar en la biblioteca de alimentos' })
    ).toBeInTheDocument();
  });
});
