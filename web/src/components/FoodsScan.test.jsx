import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import FoodsPage from './FoodsPage.jsx';
import { supabase } from '../lib/supabase.js';
import { createBarcodeDetector } from '../lib/barcodeDetector.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

vi.mock('../lib/supabase.js', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() } },
}));
// The camera reader is mocked: the real one needs a phone camera and a WebAssembly file.
vi.mock('../lib/barcodeDetector.js', () => ({ createBarcodeDetector: vi.fn() }));

const CODE = '036000291452';

const libraryRow = {
  id: 2,
  name: 'Oat flakes',
  name_es: null,
  brand: 'Brand',
  source: 'usda',
  source_id: '555',
  kcal_per_100g: 370,
  servings: [{ label: '1 cup', grams: 40 }],
  protein_g: 13,
  carbs_g: 60,
  fat_g: 7,
  fibre_g: 10,
  sugars_g: 1,
  sodium_mg: 2,
};

const usdaHit = {
  fdc_id: 999,
  name: 'Oats, branded',
  brand: 'Brand',
  kcal_per_100g: 380,
  serving_g: 40,
  serving_label: '1 cup',
};

let stream;

// Fakes the camera and the reader. `reads` is what each detect() call returns, in order.
function fakeCamera({ denied = false, reads = [[{ rawValue: CODE, format: 'upc_a' }]] } = {}) {
  const track = { stop: vi.fn() };
  stream = { getTracks: () => [track] };
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: denied
        ? vi.fn(async () => {
            throw new DOMException('denied', 'NotAllowedError');
          })
        : vi.fn(async () => stream),
    },
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
    configurable: true,
    get: () => 4,
  });
  HTMLMediaElement.prototype.play = vi.fn(async () => {});
  const detect = vi.fn();
  reads.forEach((frame) => detect.mockResolvedValueOnce(frame));
  detect.mockResolvedValue([]);
  createBarcodeDetector.mockResolvedValue({ engine: 'polyfill', detector: { detect } });
  return { detect };
}

// Library and USDA backend. `lookup` is what usda_lookup_gtin answers.
// `off` is what off-lookup answers (ticket 19); by default Open Food Facts has no such code.
function fakeBackend({ lookup = { food_id: 2 }, lookupError, off = { status: 'notFound' } } = {}) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    single: async () => ({ data: libraryRow, error: null }),
    order: () => chain,
    limit: async () => ({ data: [], error: null }),
  };
  supabase.from.mockImplementation(() => chain);
  supabase.functions.invoke.mockImplementation(async (name) =>
    name === 'off-lookup'
      ? { data: off, error: null }
      : { data: { status: 'translated' }, error: null }
  );
  supabase.rpc.mockImplementation(async (name) => {
    if (name === 'usda_lookup_gtin') {
      return lookupError ? { data: null, error: new Error('down') } : { data: lookup, error: null };
    }
    if (name === 'usda_search') return { data: [], error: null };
    return { data: null, error: null };
  });
}

function renderScreen() {
  return render(<FoodsPage />, { wrapper: I18nProvider });
}

describe('FoodsPage scan (ticket 18)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a food already in the Food Library, without calling USDA', async () => {
    fakeCamera();
    fakeBackend({ lookup: { food_id: 2 } });
    renderScreen();

    await userEvent.click(screen.getByRole('button', { name: 'Scan a barcode' }));

    expect(await screen.findByText(`Found by barcode ${CODE}.`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Oat flakes · Brand' })).toBeInTheDocument();
    expect(screen.getByText('In your Food Library')).toBeInTheDocument();
    // Calories and macros are shown for a library food
    expect(screen.getByRole('row', { name: /Protein/ })).toBeInTheDocument();
    // One database call, and it is the GTIN lookup: no USDA search
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('usda_lookup_gtin', { p_code: '00036000291452' });
    expect(supabase.rpc).not.toHaveBeenCalledWith('usda_search', expect.anything());
  });

  it('closes the camera once a code is read', async () => {
    fakeCamera();
    fakeBackend();
    renderScreen();

    await userEvent.click(screen.getByRole('button', { name: 'Scan a barcode' }));
    await screen.findByText(`Found by barcode ${CODE}.`);

    expect(stream.getTracks()[0].stop).toHaveBeenCalled();
  });

  it('ignores a read that fails its check digit and keeps scanning', async () => {
    fakeCamera({
      reads: [
        [{ rawValue: '036000291453', format: 'upc_a' }],
        [{ rawValue: CODE, format: 'upc_a' }],
      ],
    });
    fakeBackend();
    renderScreen();

    await userEvent.click(screen.getByRole('button', { name: 'Scan a barcode' }));

    expect(await screen.findByText(`Found by barcode ${CODE}.`)).toBeInTheDocument();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('usda_lookup_gtin', { p_code: '00036000291452' });
  });

  it('shows a USDA-only product with a Save button', async () => {
    fakeCamera();
    fakeBackend({ lookup: usdaHit });
    renderScreen();

    await userEvent.click(screen.getByRole('button', { name: 'Scan a barcode' }));

    const item = (await screen.findByRole('heading', { name: 'Oats, branded · Brand' })).closest(
      'li'
    );
    expect(within(item).getByText('USDA')).toBeInTheDocument();
    expect(within(item).getByRole('button', { name: 'Save to Food Library' })).toBeInTheDocument();
  });

  it('shows an Open Food Facts product with calories, macros and the credit', async () => {
    fakeCamera();
    fakeBackend({
      lookup: null,
      off: {
        status: 'found',
        barcode: '36000291452',
        offCode: '0036000291452',
        product: {
          product_name: 'Oat drink',
          brands: 'Oatly',
          nutriments: { 'energy-kcal_100g': 46, proteins_100g: 1 },
        },
      },
    });
    renderScreen();

    await userEvent.click(screen.getByRole('button', { name: 'Scan a barcode' }));

    expect(await screen.findByText(`Found by barcode ${CODE}.`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Oat drink · Oatly' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Protein/ })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Open Food Facts' });
    expect(link).toHaveAttribute('href', 'https://world.openfoodfacts.org/');
    expect(supabase.functions.invoke).toHaveBeenCalledWith('off-lookup', { body: { code: CODE } });
  });

  it('says to try again when Open Food Facts is busy, not that the food does not exist', async () => {
    fakeCamera();
    fakeBackend({ lookup: null, off: { status: 'rateLimited' } });
    renderScreen();

    await userEvent.click(screen.getByRole('button', { name: 'Scan a barcode' }));

    expect(await screen.findByText(/Open Food Facts is busy right now/)).toBeInTheDocument();
  });

  it('says Not found and offers search, never a dead end', async () => {
    fakeCamera();
    fakeBackend({ lookup: null });
    renderScreen();

    await userEvent.click(screen.getByRole('button', { name: 'Scan a barcode' }));

    expect(await screen.findByText(`Not found: no food has barcode ${CODE}.`)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Search by name' }));
    expect(screen.getByRole('searchbox', { name: 'Search foods' })).toHaveFocus();
    expect(screen.queryByText(`Not found: no food has barcode ${CODE}.`)).not.toBeInTheDocument();
  });

  it('says the lookup failed and offers search again', async () => {
    fakeCamera();
    fakeBackend({ lookupError: true });
    renderScreen();

    await userEvent.click(screen.getByRole('button', { name: 'Scan a barcode' }));

    expect(
      await screen.findByText(
        'Could not look up this barcode. Check your connection and try again.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search by name' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scan again' })).toBeInTheDocument();
  });

  it('says the camera is not available and offers search when access is refused', async () => {
    fakeCamera({ denied: true });
    fakeBackend();
    renderScreen();

    await userEvent.click(screen.getByRole('button', { name: 'Scan a barcode' }));

    expect(await screen.findByText(/The camera is not available/)).toBeInTheDocument();
    expect(createBarcodeDetector).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Search by name' }));
    expect(screen.getByRole('searchbox', { name: 'Search foods' })).toHaveFocus();
  });

  it('does not run the lookup if the scan is closed before a read', async () => {
    fakeCamera({ reads: [] });
    fakeBackend();
    renderScreen();

    await userEvent.click(screen.getByRole('button', { name: 'Scan a barcode' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Close scanner' }));

    await waitFor(() => expect(stream.getTracks()[0].stop).toHaveBeenCalled());
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Close scanner' })).not.toBeInTheDocument();
  });
});
