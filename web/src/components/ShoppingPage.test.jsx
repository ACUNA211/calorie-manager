import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShoppingPage from './ShoppingPage.jsx';
import { supabase } from '../lib/supabase.js';
import { MetricProvider } from '../test/metricUnits.jsx';

vi.mock('../lib/supabase.js', () => ({ supabase: { from: vi.fn() } }));

const rows = [
  {
    id: 1,
    item_name: 'Beans',
    quantity_needed: '1 × 1 can (425 g)',
    purchased: false,
    food_id: 2,
    source: 'plan',
    grams: 425,
    store_section: 'Canned & dry goods',
    measure_kind: 'serving',
    measure_label: '1 can',
    measure_count: 1,
    created_at: '2026-10-19T12:00:00Z',
  },
  {
    id: 2,
    item_name: 'Apple',
    quantity_needed: '150 g',
    purchased: false,
    food_id: 3,
    source: 'plan',
    grams: 150,
    store_section: 'Produce',
    measure_kind: 'weight',
    measure_label: null,
    measure_count: 3,
    created_at: '2026-10-19T12:00:00Z',
  },
  {
    id: 3,
    item_name: 'Beans',
    quantity_needed: '+2 × 1 can (850 g)',
    purchased: false,
    food_id: 2,
    source: 'plan_extra',
    grams: 850,
    store_section: 'Canned & dry goods',
    measure_kind: 'serving',
    measure_label: '1 can',
    measure_count: 2,
    created_at: '2026-10-21T12:00:00Z',
  },
  {
    id: 4,
    item_name: 'Foil',
    quantity_needed: 'one roll',
    purchased: false,
    food_id: null,
    source: 'hand',
    grams: null,
    store_section: 'Other',
    measure_kind: null,
    measure_label: null,
    measure_count: null,
    created_at: '2026-10-20T12:00:00Z',
  },
  {
    id: 5,
    item_name: 'Rice',
    quantity_needed: '1 × package (1000 g)',
    purchased: true,
    food_id: 1,
    source: 'plan',
    grams: 1000,
    store_section: 'Canned & dry goods',
    measure_kind: 'package',
    measure_label: null,
    measure_count: 1,
    created_at: '2026-10-19T12:00:00Z',
  },
];

function fakeList(data, error = null) {
  const chain = {
    select: () => chain,
    order: () => (chain.calls++ >= 1 ? Promise.resolve({ data, error }) : chain),
    calls: 0,
  };
  supabase.from.mockImplementation(() => chain);
}

function renderPage() {
  return render(
    <MetricProvider>
      <ShoppingPage />
    </MetricProvider>
  );
}

describe('ShoppingPage', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('groups lines by store section in shopping order', async () => {
    fakeList(rows);
    renderPage();
    await screen.findByText('Apple');
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Produce', 'Canned & dry goods', 'Other', 'Done']);
  });

  it('shows the shopping measure and the date each line was added', async () => {
    fakeList(rows);
    renderPage();
    await screen.findByText('Apple');
    const canned = screen.getByRole('heading', { name: 'Canned & dry goods' }).closest('section');
    const items = within(canned).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Beans');
    expect(items[0]).toHaveTextContent('1 × 1 can (425 g)');
    expect(items[0]).toHaveTextContent(/Added .*19/);
    expect(items[1]).toHaveTextContent('+ 2 × 1 can (425 g)');
    expect(items[1]).toHaveTextContent(/Added .*21/);
    const produce = screen.getByRole('heading', { name: 'Produce' }).closest('section');
    expect(produce).toHaveTextContent('150 g');
  });

  it('keeps the text of a hand-added line', async () => {
    fakeList(rows);
    renderPage();
    expect(await screen.findByText('one roll')).toBeInTheDocument();
  });

  it('puts ticked lines in a done section', async () => {
    fakeList(rows);
    renderPage();
    await screen.findByText('Apple');
    const done = screen.getByRole('heading', { name: 'Done' }).closest('section');
    expect(done).toHaveTextContent('Rice');
    expect(done).toHaveTextContent('1 × package (1 kg)');
  });

  it('says so when there is nothing to buy', async () => {
    fakeList([]);
    renderPage();
    expect(await screen.findByText(/Nothing to buy yet/)).toBeInTheDocument();
  });

  it('shows an error when the list cannot be loaded', async () => {
    fakeList(null, { message: 'down' });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load your Shopping list.'
    );
  });
});
