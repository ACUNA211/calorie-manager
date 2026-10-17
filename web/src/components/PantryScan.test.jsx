import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import PantryScan from './PantryScan.jsx';
import { supabase } from '../lib/supabase.js';
import { createBarcodeDetector } from '../lib/barcodeDetector.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

vi.mock('../lib/supabase.js', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
// The camera and the reader are mocked: the real ones need a phone camera and a WebAssembly file.
vi.mock('../lib/barcodeDetector.js', () => ({ createBarcodeDetector: vi.fn() }));

const CODE = '036000291452';

// A Food Library row as the database returns it.
function food(id, overrides = {}) {
  return {
    id,
    name: 'Food',
    name_es: null,
    name_es_edited_by_member: false,
    brand: null,
    source: 'label',
    source_id: null,
    kcal_per_100g: 100,
    servings: [],
    package_grams: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    fibre_g: null,
    sugars_g: null,
    sodium_mg: null,
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

// The Food Library, the Pantry and the scan functions. `lookup` is what usda_lookup_gtin
// answers (null for not found). `saveId` is what usda_save returns.
function fakeBackend({
  foods = {},
  lookup = null,
  lookupError = null,
  addError = null,
  saveId = 9,
} = {}) {
  const state = { foods, pantry: [], calls: [] };
  supabase.from.mockImplementation((table) => {
    if (table === 'pantry_items') {
      return {
        select: () => ({
          order: async () => ({ data: state.pantry.map((row) => ({ ...row })), error: null }),
        }),
      };
    }
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
  });
  supabase.rpc.mockImplementation(async (name, args) => {
    state.calls.push([name, args]);
    if (name === 'usda_lookup_gtin') {
      return lookupError ? { data: null, error: lookupError } : { data: lookup, error: null };
    }
    if (name === 'usda_save') return { data: saveId, error: null };
    if (name === 'set_package_grams') {
      state.foods[args.p_food_id].package_grams = args.p_grams;
      return { data: args.p_grams, error: null };
    }
    if (name === 'pantry_add') {
      if (addError) return { data: null, error: addError };
      const existing = state.pantry.find((row) => row.food_id === args.p_food_id);
      if (existing) {
        existing.grams += args.p_grams;
      } else {
        state.pantry.push({
          id: state.pantry.length + 1,
          food_id: args.p_food_id,
          grams: args.p_grams,
          foods: { name: state.foods[args.p_food_id].name, brand: null, store_section: 'Pantry' },
        });
      }
      return { data: 1, error: null };
    }
    return { data: null, error: null };
  });
  return state;
}

const addCalls = (state) => state.calls.filter(([name]) => name === 'pantry_add');

function renderScan(onAdded = vi.fn()) {
  render(<PantryScan onAdded={onAdded} />, { wrapper: I18nProvider });
  return onAdded;
}

describe('PantryScan (ticket #26)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  // Vitest runs without globals here, so Testing Library does not clean up on its own.
  afterEach(() => {
    cleanup();
  });

  it('adds one package at its label weight, and another on the next scan', async () => {
    const user = userEvent.setup();
    const backend = fakeBackend({
      foods: {
        2: food(2, { name: 'Tomato soup', servings: [{ label: '1 can (425 g)', grams: 425 }] }),
      },
      lookup: { food_id: 2 },
    });
    const onAdded = renderScan();

    fakeCamera();
    await user.click(screen.getByRole('button', { name: 'Scan a package' }));
    expect(
      await screen.findByText('Added one package of Tomato soup (425 g) to the Pantry.')
    ).toBeInTheDocument();
    expect(addCalls(backend)).toEqual([['pantry_add', { p_food_id: 2, p_grams: 425 }]]);
    expect(onAdded).toHaveBeenCalledTimes(1);

    fakeCamera();
    await user.click(screen.getByRole('button', { name: 'Scan another package' }));
    await waitFor(() => expect(addCalls(backend)).toHaveLength(2));
    expect(backend.pantry).toEqual([expect.objectContaining({ food_id: 2, grams: 850 })]);
    expect(onAdded).toHaveBeenCalledTimes(2);
  });

  it('asks for an unknown package weight once and remembers it on the food', async () => {
    const user = userEvent.setup();
    const backend = fakeBackend({
      foods: { 3: food(3, { name: 'Oat flakes', servings: [{ label: '1 cup', grams: 40 }] }) },
      lookup: { food_id: 3 },
    });
    renderScan();

    fakeCamera();
    await user.click(screen.getByRole('button', { name: 'Scan a package' }));
    expect(
      await screen.findByText(
        'How many grams does one package of Oat flakes weigh? The app remembers it for next time.'
      )
    ).toBeInTheDocument();
    expect(addCalls(backend)).toEqual([]);

    await user.type(
      screen.getByRole('textbox', { name: 'Grams in one package of Oat flakes' }),
      '450'
    );
    await user.click(screen.getByRole('button', { name: 'Save weight and add' }));
    expect(
      await screen.findByText('Added one package of Oat flakes (450 g) to the Pantry.')
    ).toBeInTheDocument();
    expect(backend.calls).toContainEqual(['set_package_grams', { p_food_id: 3, p_grams: 450 }]);
    expect(addCalls(backend)).toEqual([['pantry_add', { p_food_id: 3, p_grams: 450 }]]);

    // The next scan knows the weight: no question, one more package.
    fakeCamera();
    await user.click(screen.getByRole('button', { name: 'Scan another package' }));
    await waitFor(() => expect(addCalls(backend)).toHaveLength(2));
    expect(
      screen.queryByRole('textbox', { name: 'Grams in one package of Oat flakes' })
    ).toBeNull();
    expect(backend.calls.filter(([name]) => name === 'set_package_grams')).toHaveLength(1);
  });

  it('refuses a weight that is not a number of grams and asks again', async () => {
    const user = userEvent.setup();
    const backend = fakeBackend({
      foods: { 3: food(3, { name: 'Oat flakes' }) },
      lookup: { food_id: 3 },
    });
    renderScan();

    fakeCamera();
    await user.click(screen.getByRole('button', { name: 'Scan a package' }));
    await user.type(
      await screen.findByRole('textbox', { name: 'Grams in one package of Oat flakes' }),
      'lots'
    );
    await user.click(screen.getByRole('button', { name: 'Save weight and add' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Use a number of grams');
    expect(backend.calls.filter(([name]) => name === 'set_package_grams')).toHaveLength(0);
    expect(addCalls(backend)).toEqual([]);
  });

  it('says a code was not found and offers search, never a dead end', async () => {
    const user = userEvent.setup();
    const backend = fakeBackend({ lookup: null });
    renderScan();

    fakeCamera();
    await user.click(screen.getByRole('button', { name: 'Scan a package' }));
    expect(
      await screen.findByText(`No food matches the barcode ${CODE}. Search for it by name instead.`)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search by name instead' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scan another package' })).toBeInTheDocument();
    expect(addCalls(backend)).toEqual([]);
  });

  it('says the lookup failed when the call fails', async () => {
    const user = userEvent.setup();
    const backend = fakeBackend({ lookupError: new Error('offline') });
    renderScan();

    fakeCamera();
    await user.click(screen.getByRole('button', { name: 'Scan a package' }));
    expect(
      await screen.findByText(
        'Could not look this package up. Check your connection and try again.'
      )
    ).toBeInTheDocument();
    expect(addCalls(backend)).toEqual([]);
  });

  it('saves a USDA-only food to the Food Library, then adds its package', async () => {
    const user = userEvent.setup();
    const backend = fakeBackend({
      foods: { 9: food(9, { name: 'Lentils', package_grams: 400 }) },
      lookup: { fdc_id: 555, name: 'Lentils', brand: null, kcal_per_100g: 350, serving_g: null },
      saveId: 9,
    });
    renderScan();

    fakeCamera();
    await user.click(screen.getByRole('button', { name: 'Scan a package' }));
    expect(
      await screen.findByText('Added one package of Lentils (400 g) to the Pantry.')
    ).toBeInTheDocument();
    expect(backend.calls).toContainEqual(['usda_save', { p_fdc_id: 555 }]);
    expect(addCalls(backend)).toEqual([['pantry_add', { p_food_id: 9, p_grams: 400 }]]);
  });

  it('says the package could not be added when the add fails', async () => {
    const user = userEvent.setup();
    fakeBackend({
      foods: { 2: food(2, { name: 'Tomato soup', package_grams: 425 }) },
      lookup: { food_id: 2 },
      addError: new Error('down'),
    });
    renderScan();

    fakeCamera();
    await user.click(screen.getByRole('button', { name: 'Scan a package' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not add this package. Try again.'
    );
  });
});
