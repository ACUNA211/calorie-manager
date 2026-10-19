import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShoppingScan from './ShoppingScan.jsx';
import ShoppingPage from './ShoppingPage.jsx';
import { supabase } from '../lib/supabase.js';
import { createBarcodeDetector } from '../lib/barcodeDetector.js';
import { MetricProvider } from '../test/metricUnits.jsx';

vi.mock('../lib/supabase.js', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() } },
}));
// The camera and the reader are faked: the real ones need a phone camera and a WebAssembly file.
vi.mock('../lib/barcodeDetector.js', () => ({ createBarcodeDetector: vi.fn() }));

const CODE = '036000291452';

function food(id, overrides = {}) {
  return {
    id,
    name: 'Food',
    package_grams: null,
    servings: [],
    ...overrides,
  };
}

function line(id, overrides = {}) {
  return {
    id,
    name: 'Tomato soup',
    foodId: 2,
    source: 'plan',
    purchased: false,
    pending: null,
    grams: 400,
    addedAt: '2026-10-19T12:00:00Z',
    ...overrides,
  };
}

// Each open of the camera reads the barcode once, then reads nothing.
function fakeCamera() {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => stream) },
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
    configurable: true,
    get: () => 4,
  });
  HTMLMediaElement.prototype.play = vi.fn(async () => {});
  const detect = vi.fn();
  detect.mockResolvedValueOnce([{ rawValue: CODE, format: 'upc_a' }]);
  detect.mockResolvedValue([]);
  createBarcodeDetector.mockResolvedValue({ engine: 'polyfill', detector: { detect } });
}

// The Food Library and the scan functions. `lookup` is what usda_lookup_gtin answers (null for
// nothing); `off` is what the off-lookup function answers when USDA has nothing.
function fakeBackend({ foods = {}, lookup = null, off = { status: 'notFound' } } = {}) {
  const state = { foods, calls: [] };
  const fromFoods = () => {
    let foodId = null;
    const chain = {
      select: () => chain,
      eq: (column, value) => {
        foodId = Number(value);
        return chain;
      },
      single: async () =>
        state.foods[foodId]
          ? { data: { ...state.foods[foodId] }, error: null }
          : { data: null, error: new Error('missing') },
    };
    return chain;
  };
  supabase.from.mockImplementation(fromFoods);
  supabase.functions.invoke.mockResolvedValue({ data: off, error: null });
  supabase.rpc.mockImplementation(async (name, args) => {
    state.calls.push([name, args]);
    if (name === 'usda_lookup_gtin') return { data: lookup, error: null };
    if (name === 'usda_save') return { data: 9, error: null };
    if (name === 'set_package_grams') {
      state.foods[args.p_food_id].package_grams = args.p_grams;
      return { data: args.p_grams, error: null };
    }
    if (name === 'pantry_add') return { data: 1, error: null };
    return { data: null, error: null };
  });
  return state;
}

const callsTo = (state, name) => state.calls.filter(([called]) => called === name);

function renderScan(lines, onTick = vi.fn(async () => true)) {
  render(<ShoppingScan lines={lines} onTick={onTick} />, { wrapper: MetricProvider });
  return onTick;
}

async function startScan(user) {
  fakeCamera();
  await user.click(screen.getByRole('button', { name: 'Scan a product' }));
}

describe('ShoppingScan (ticket #49)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });
  afterEach(cleanup);

  it('ticks the open line Bought with the real package weight, not the planned amount', async () => {
    const user = userEvent.setup();
    const backend = fakeBackend({
      foods: {
        2: food(2, { name: 'Tomato soup', servings: [{ label: '1 can (425 g)', grams: 425 }] }),
      },
      lookup: { food_id: 2 },
    });
    const onTick = renderScan([line(1)]);

    await startScan(user);
    expect(
      await screen.findByText('Tomato soup ticked Bought at its real weight, 425 g.')
    ).toBeInTheDocument();
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(onTick).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 425);
    expect(callsTo(backend, 'pantry_add')).toEqual([]);
  });

  it('ticks the planned line before an extra line of the same food', async () => {
    const user = userEvent.setup();
    fakeBackend({ foods: { 2: food(2, { package_grams: 425 }) }, lookup: { food_id: 2 } });
    const onTick = renderScan([line(7, { source: 'plan_extra' }), line(3)]);

    await startScan(user);
    await screen.findByText(/ticked Bought/);
    expect(onTick).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }), 425);
  });

  it('asks for an unknown package weight once, remembers it, then ticks with it', async () => {
    const user = userEvent.setup();
    const backend = fakeBackend({
      foods: { 2: food(2, { name: 'Tomato soup' }) },
      lookup: { food_id: 2 },
    });
    const onTick = renderScan([line(1)]);

    await startScan(user);
    await user.type(
      await screen.findByRole('textbox', { name: 'Weight of one package of Tomato soup (g)' }),
      '410'
    );
    expect(onTick).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save weight and continue' }));
    expect(await screen.findByText(/ticked Bought at its real weight, 410 g/)).toBeInTheDocument();
    expect(callsTo(backend, 'set_package_grams')).toEqual([
      ['set_package_grams', { p_food_id: 2, p_grams: 410 }],
    ]);
    expect(onTick).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 410);
  });

  it('says so when the tick fails', async () => {
    const user = userEvent.setup();
    fakeBackend({ foods: { 2: food(2, { package_grams: 425 }) }, lookup: { food_id: 2 } });
    renderScan(
      [line(1)],
      vi.fn(async () => false)
    );

    await startScan(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not tick that line.');
  });

  it('asks before adding a product that is not on the list, then adds it with a note', async () => {
    const user = userEvent.setup();
    const backend = fakeBackend({
      foods: { 3: food(3, { name: 'Oat flakes', package_grams: 500 }) },
      lookup: { food_id: 3 },
    });
    const onTick = renderScan([line(1)]);

    await startScan(user);
    expect(
      await screen.findByText(
        'Oat flakes is not on the Shopping list. Add one package to the Pantry?'
      )
    ).toBeInTheDocument();
    expect(callsTo(backend, 'pantry_add')).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Add to the Pantry' }));
    expect(
      await screen.findByText(
        'Added one package of Oat flakes (500 g) to the Pantry. It was not on the Shopping list.'
      )
    ).toBeInTheDocument();
    expect(callsTo(backend, 'pantry_add')).toEqual([
      ['pantry_add', { p_food_id: 3, p_grams: 500 }],
    ]);
    expect(onTick).not.toHaveBeenCalled();
  });

  it('adds nothing when the offer is closed', async () => {
    const user = userEvent.setup();
    const backend = fakeBackend({
      foods: { 3: food(3, { name: 'Oat flakes', package_grams: 500 }) },
      lookup: { food_id: 3 },
    });
    renderScan([]);

    await startScan(user);
    await screen.findByText(/is not on the Shopping list/);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(callsTo(backend, 'pantry_add')).toEqual([]);
    expect(screen.getByRole('button', { name: 'Scan a product' })).toBeInTheDocument();
  });

  it('treats a food whose lines are all ticked as off the list', async () => {
    const user = userEvent.setup();
    fakeBackend({
      foods: { 2: food(2, { name: 'Tomato soup', package_grams: 425 }) },
      lookup: { food_id: 2 },
    });
    const onTick = renderScan([line(1, { purchased: true })]);

    await startScan(user);
    expect(
      await screen.findByText(
        'Tomato soup is already ticked on the list. Add another package to the Pantry?'
      )
    ).toBeInTheDocument();
    expect(onTick).not.toHaveBeenCalled();
  });

  it('asks for the weight before adding an off-list product with an unknown package', async () => {
    const user = userEvent.setup();
    const backend = fakeBackend({
      foods: { 3: food(3, { name: 'Oat flakes' }) },
      lookup: { food_id: 3 },
    });
    renderScan([]);

    await startScan(user);
    await user.click(await screen.findByRole('button', { name: 'Add to the Pantry' }));
    await user.type(
      await screen.findByRole('textbox', { name: 'Weight of one package of Oat flakes (g)' }),
      '450'
    );
    await user.click(screen.getByRole('button', { name: 'Save weight and continue' }));
    expect(
      await screen.findByText(/Added one package of Oat flakes \(450 g\)/)
    ).toBeInTheDocument();
    expect(callsTo(backend, 'pantry_add')).toEqual([
      ['pantry_add', { p_food_id: 3, p_grams: 450 }],
    ]);
  });

  it('saves a USDA-only food to the Food Library, then ticks its line', async () => {
    const user = userEvent.setup();
    const backend = fakeBackend({
      foods: { 9: food(9, { name: 'Lentils', package_grams: 400 }) },
      lookup: { fdc_id: 555, name: 'Lentils', brand: null, kcal_per_100g: 350, serving_g: null },
    });
    const onTick = renderScan([line(4, { foodId: 9, name: 'Lentils' })]);

    await startScan(user);
    await screen.findByText(/Lentils ticked Bought at its real weight, 400 g/);
    expect(callsTo(backend, 'usda_save')).toEqual([['usda_save', { p_fdc_id: 555 }]]);
    expect(onTick).toHaveBeenCalledWith(expect.objectContaining({ id: 4 }), 400);
  });

  it('offers to type in the label for a code nothing knows, and never ticks', async () => {
    const user = userEvent.setup();
    fakeBackend({ lookup: null, off: { status: 'notFound' } });
    const onTick = renderScan([line(1)]);

    await startScan(user);
    expect(await screen.findByText(`No food matches the barcode ${CODE}.`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Type in the label' }));
    expect(
      screen.getByRole('form', { name: 'Type in the Nutrition Facts label' })
    ).toBeInTheDocument();
    expect(onTick).not.toHaveBeenCalled();
  });

  it('does not offer the label when Open Food Facts was busy', async () => {
    const user = userEvent.setup();
    fakeBackend({ lookup: null, off: { status: 'rateLimited' } });
    renderScan([line(1)]);

    await startScan(user);
    expect(await screen.findByText(/Open Food Facts is busy/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Type in the label' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Scan another product' })).toBeInTheDocument();
  });

  it('shows an Open Food Facts product with its credit and does not tick it', async () => {
    const user = userEvent.setup();
    fakeBackend({
      lookup: null,
      off: {
        status: 'found',
        barcode: CODE,
        product: { product_name: 'Cola', nutriments: { 'energy-kcal_100g': 42 } },
      },
    });
    const onTick = renderScan([line(1)]);

    await startScan(user);
    expect(await screen.findByText(/Cola was found on Open Food Facts/)).toBeInTheDocument();
    expect(onTick).not.toHaveBeenCalled();
  });

  it('disables Scan with no connection', () => {
    render(<ShoppingScan lines={[]} online={false} onTick={vi.fn()} />, {
      wrapper: MetricProvider,
    });
    expect(screen.getByRole('button', { name: 'Scan a product' })).toBeDisabled();
  });
});

describe('Scan on the Shopping page (ticket #49)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });
  afterEach(cleanup);

  it('sends the scanned weight through shopping_tick and moves the line to Done', async () => {
    const user = userEvent.setup();
    const listRow = {
      id: 5,
      item_name: 'Tomato soup',
      quantity_needed: '1 × 1 can (400 g)',
      purchased: false,
      food_id: 2,
      source: 'plan',
      grams: 400,
      need_grams: 400,
      store_section: 'Canned & dry goods',
      measure_kind: 'weight',
      measure_label: null,
      measure_count: 8,
      created_at: '2026-10-19T12:00:00Z',
    };
    const soup = food(2, { name: 'Tomato soup', package_grams: 425 });
    supabase.from.mockImplementation((table) => {
      if (table === 'grocery_list') {
        const chain = {
          select: () => chain,
          order: () =>
            chain.calls++ >= 1 ? Promise.resolve({ data: [listRow], error: null }) : chain,
          calls: 0,
        };
        return chain;
      }
      const chain = {
        select: () => chain,
        eq: () => chain,
        single: async () => ({ data: soup, error: null }),
      };
      return chain;
    });
    supabase.functions.invoke.mockResolvedValue({ data: { status: 'notFound' }, error: null });
    supabase.rpc.mockImplementation(async (name) => {
      if (name === 'usda_lookup_gtin') return { data: { food_id: 2 }, error: null };
      if (name === 'shopping_tick') {
        return {
          data: { applied: true, line_id: 5, pantry_grams: 425, pantry_delta: 425 },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    render(<ShoppingPage />, { wrapper: MetricProvider });
    await screen.findByText('Tomato soup');

    await startScan(user);
    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith('shopping_tick', {
        p_line_id: 5,
        p_kind: 'bought',
        p_grams: 425,
      })
    );
    expect(await screen.findByText(/ticked Bought at its real weight, 425 g/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bought: Tomato soup' })).toBeNull();
  });
});
