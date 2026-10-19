import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShoppingPage from './ShoppingPage.jsx';
import { supabase } from '../lib/supabase.js';
import { MetricProvider } from '../test/metricUnits.jsx';

vi.mock('../lib/supabase.js', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));

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

  describe('ticking', () => {
    afterEach(() => vi.useRealTimers());

    it('Bought ticks the line, moves it to Done and shows Undo', async () => {
      fakeList(rows);
      supabase.rpc.mockResolvedValue({
        data: { applied: true, line_id: 2, pantry_grams: 150, pantry_delta: 150 },
        error: null,
      });
      renderPage();
      await screen.findByText('Apple');
      fireEvent.click(screen.getByRole('button', { name: 'Bought: Apple' }));
      expect(supabase.rpc).toHaveBeenCalledWith('shopping_tick', {
        p_line_id: 2,
        p_kind: 'bought',
        p_grams: null,
      });
      const done = screen.getByRole('heading', { name: 'Done' }).closest('section');
      await waitFor(() => expect(done).toHaveTextContent('Apple'));
      expect(screen.queryByRole('button', { name: 'Bought: Apple' })).toBeNull();
      expect(await screen.findByRole('status')).toHaveTextContent(
        'Apple ticked Bought. Pantry now 150 g.'
      );
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    });

    it('Have it sends the other kind', async () => {
      fakeList(rows);
      supabase.rpc.mockResolvedValue({
        data: { applied: true, line_id: 2, pantry_grams: 150, pantry_delta: 150 },
        error: null,
      });
      renderPage();
      await screen.findByText('Apple');
      fireEvent.click(screen.getByRole('button', { name: 'Have it: Apple' }));
      await waitFor(() =>
        expect(supabase.rpc).toHaveBeenCalledWith('shopping_tick', {
          p_line_id: 2,
          p_kind: 'have_it',
          p_grams: null,
        })
      );
      expect(await screen.findByRole('status')).toHaveTextContent('ticked Have it');
    });

    it('offers only one tick on a hand-added line and none on a ticked line', async () => {
      fakeList(rows);
      renderPage();
      await screen.findByText('Apple');
      expect(screen.getByRole('button', { name: 'Bought: Foil' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Have it: Foil' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Bought: Rice' })).toBeNull();
    });

    it('Undo calls the database, puts the line back and clears the toast', async () => {
      fakeList(rows);
      supabase.rpc
        .mockResolvedValueOnce({
          data: { applied: true, line_id: 2, pantry_grams: 150, pantry_delta: 150 },
          error: null,
        })
        .mockResolvedValueOnce({ data: { line_id: 2, pantry_grams: 0 }, error: null });
      renderPage();
      await screen.findByText('Apple');
      fireEvent.click(screen.getByRole('button', { name: 'Bought: Apple' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
      await waitFor(() =>
        expect(supabase.rpc).toHaveBeenLastCalledWith('shopping_untick', { p_line_id: 2 })
      );
      expect(await screen.findByRole('button', { name: 'Bought: Apple' })).toBeInTheDocument();
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('Undo goes away after a few seconds', async () => {
      fakeList(rows);
      supabase.rpc.mockResolvedValue({
        data: { applied: true, line_id: 2, pantry_grams: 150, pantry_delta: 150 },
        error: null,
      });
      renderPage();
      await screen.findByText('Apple');
      vi.useFakeTimers({ shouldAdvanceTime: true });
      fireEvent.click(screen.getByRole('button', { name: 'Bought: Apple' }));
      await screen.findByRole('button', { name: 'Undo' });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5100);
      });
      expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
      expect(
        within(screen.getByRole('heading', { name: 'Done' }).closest('section')).getByText('Apple')
      ).toBeInTheDocument();
    });

    it('puts the line back and says so when the tick fails', async () => {
      fakeList(rows);
      supabase.rpc.mockResolvedValue({ data: null, error: { message: 'down' } });
      renderPage();
      await screen.findByText('Apple');
      fireEvent.click(screen.getByRole('button', { name: 'Bought: Apple' }));
      expect(await screen.findByRole('status')).toHaveTextContent('Could not tick that line');
      expect(screen.getByRole('button', { name: 'Bought: Apple' })).toBeInTheDocument();
    });

    it('shows no Undo when the line was already ticked by someone else', async () => {
      fakeList(rows);
      supabase.rpc.mockResolvedValue({ data: { applied: false, line_id: 2 }, error: null });
      renderPage();
      await screen.findByText('Apple');
      fireEvent.click(screen.getByRole('button', { name: 'Bought: Apple' }));
      await waitFor(() => expect(supabase.rpc).toHaveBeenCalled());
      expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    });
  });
});
