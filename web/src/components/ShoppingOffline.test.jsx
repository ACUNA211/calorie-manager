import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShoppingPage from './ShoppingPage.jsx';
import { supabase } from '../lib/supabase.js';
import { MetricProvider } from '../test/metricUnits.jsx';
import { LIST_CACHE_KEY } from '../lib/shopping.js';
import { SHOPPING_QUEUE_KEY } from '../lib/offlineQueue.js';

vi.mock('../lib/supabase.js', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));

const rows = [
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
    client_id: null,
  },
];

// The list query answers with `data`, or never reaches the server when `data` is null.
function fakeList(data) {
  const chain = {
    select: () => chain,
    order: () =>
      chain.calls++ >= 1
        ? data
          ? Promise.resolve({ data, error: null })
          : Promise.resolve({ data: null, error: { message: 'Failed to fetch', code: '' } })
        : chain,
    calls: 0,
  };
  supabase.from.mockImplementation(() => chain);
}

let onLine = true;
function setOnline(value) {
  onLine = value;
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
  });
}

function renderPage() {
  return render(
    <MetricProvider>
      <ShoppingPage />
    </MetricProvider>
  );
}

const queue = () => JSON.parse(window.localStorage.getItem(SHOPPING_QUEUE_KEY) || '[]');

describe('Shopping list with no signal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    onLine = true;
    vi.spyOn(window.navigator, 'onLine', 'get').mockImplementation(() => onLine);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('keeps a tick on the phone with no network and sends it when back online', async () => {
    fakeList(rows);
    renderPage();
    await screen.findByText('Apple');
    setOnline(false);
    expect(screen.getByText(/No connection/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bought: Apple' }));
    expect(supabase.rpc).not.toHaveBeenCalled();
    const done = screen.getByRole('heading', { name: 'Done' }).closest('section');
    expect(done).toHaveTextContent('Apple');
    expect(done).toHaveTextContent('Not synced');
    expect(await screen.findByRole('status')).toHaveTextContent('Kept on this phone');
    expect(queue()).toHaveLength(1);
    expect(queue()[0].row).toMatchObject({ op: 'tick', lineId: 2, kind: 'bought' });

    supabase.rpc.mockResolvedValue({
      data: { applied: true, line_id: 2, pantry_grams: 150, pantry_delta: 150 },
      error: null,
    });
    setOnline(true);
    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith('shopping_tick', {
        p_line_id: 2,
        p_kind: 'bought',
        p_grams: null,
      })
    );
    await waitFor(() => expect(queue()).toHaveLength(0));
    await waitFor(() => expect(screen.queryByText('Not synced')).toBeNull());
  });

  it('queues a tick when the request itself fails to reach the server', async () => {
    fakeList(rows);
    renderPage();
    await screen.findByText('Apple');
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch', code: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Have it: Apple' }));
    await waitFor(() => expect(queue()).toHaveLength(1));
    expect(queue()[0].row.kind).toBe('have_it');
  });

  it('Undo on a queued tick takes it off the queue', async () => {
    fakeList(rows);
    renderPage();
    await screen.findByText('Apple');
    setOnline(false);
    fireEvent.click(screen.getByRole('button', { name: 'Bought: Apple' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(queue()).toHaveLength(0);
    expect(await screen.findByRole('button', { name: 'Bought: Apple' })).toBeInTheDocument();
  });

  it('opens from the last list seen when the page loads with no network', async () => {
    window.localStorage.setItem(
      LIST_CACHE_KEY,
      JSON.stringify([
        {
          id: 2,
          name: 'Apple',
          foodId: 3,
          source: 'plan',
          purchased: false,
          grams: 150,
          needGrams: 150,
          text: '150 g',
          storeSection: 'Produce',
          measureKind: 'weight',
          measureLabel: null,
          measureCount: 3,
          addedAt: '2026-10-19T12:00:00Z',
          clientId: null,
          pending: null,
        },
      ])
    );
    onLine = false;
    fakeList(null);
    renderPage();
    expect(await screen.findByText('Apple')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bought: Apple' }));
    expect(queue()).toHaveLength(1);
  });

  it('adds a free-text line with no network and sends it, once, when back online', async () => {
    fakeList(rows);
    renderPage();
    await screen.findByText('Apple');
    setOnline(false);

    fireEvent.change(screen.getByLabelText('What to buy'), { target: { value: 'Foil' } });
    fireEvent.change(screen.getByLabelText('Amount (optional)'), { target: { value: 'one roll' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to the list' }));

    expect(await screen.findByTestId('shopping-add-status')).toHaveTextContent(
      'kept on this phone'
    );
    const other = screen.getByRole('heading', { name: 'Other' }).closest('section');
    const item = within(other).getByText('Foil').closest('li');
    expect(item).toHaveTextContent('one roll');
    expect(item).toHaveTextContent('Not synced');
    expect(within(item).queryByRole('button')).toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalled();
    const clientId = queue()[0].row.clientId;
    expect(clientId).toMatch(/^[0-9a-f-]{36}$/);

    supabase.rpc.mockResolvedValue({ data: { line_id: 9, created: true }, error: null });
    setOnline(true);
    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith('shopping_add_line', {
        p_client_id: clientId,
        p_name: 'Foil',
        p_food_id: null,
        p_grams: null,
        p_text: 'one roll',
      })
    );
    await waitFor(() => expect(queue()).toHaveLength(0));
    expect(supabase.rpc.mock.calls.filter(([name]) => name === 'shopping_add_line')).toHaveLength(
      1
    );
  });

  it('adds a line online straight away', async () => {
    fakeList(rows);
    supabase.rpc.mockResolvedValue({ data: { line_id: 9, created: true }, error: null });
    renderPage();
    await screen.findByText('Apple');
    fireEvent.change(screen.getByLabelText('What to buy'), { target: { value: 'Soap' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to the list' }));
    expect(await screen.findByTestId('shopping-add-status')).toHaveTextContent('Added Soap');
    expect(queue()).toHaveLength(0);
  });

  it('picks a food from the library and keeps its amount as grams', async () => {
    const food = {
      id: 5,
      name: 'Rice',
      name_es: null,
      source: 'label',
      kcal_per_100g: 365,
      servings: [],
    };
    const foodChain = {
      select: () => foodChain,
      order: () => foodChain,
      limit: () => Promise.resolve({ data: [food], error: null }),
    };
    const listChain = {
      select: () => listChain,
      order: () => (listChain.n++ >= 1 ? Promise.resolve({ data: rows, error: null }) : listChain),
      n: 0,
    };
    supabase.from.mockImplementation((table) => (table === 'foods' ? foodChain : listChain));
    supabase.rpc.mockResolvedValue({ data: { line_id: 9, created: true }, error: null });
    renderPage();
    await screen.findByText('Apple');
    fireEvent.change(screen.getByLabelText('What to buy'), { target: { value: 'rice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find in the Food Library' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use Rice' }));
    fireEvent.change(screen.getByLabelText(/Amount in g/), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to the list' }));
    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith(
        'shopping_add_line',
        expect.objectContaining({ p_name: 'Rice', p_food_id: 5, p_grams: 500, p_text: '500 g' })
      )
    );
  });

  it('refuses an empty line and a bad amount', async () => {
    fakeList(rows);
    renderPage();
    await screen.findByText('Apple');
    fireEvent.click(screen.getByRole('button', { name: 'Add to the list' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Type what to buy');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('shows a refused queued tick with Try again and Discard', async () => {
    window.localStorage.setItem(
      SHOPPING_QUEUE_KEY,
      JSON.stringify([
        {
          clientId: 'tick:2',
          memberId: null,
          logDate: null,
          queuedAt: '2026-10-19T09:00:00Z',
          row: { op: 'tick', lineId: 2, kind: 'bought', grams: null },
          status: 'failed',
          error: 'not in Household',
        },
      ])
    );
    fakeList(rows);
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('not in Household');
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(queue()).toHaveLength(0);
  });
});
