import { describe, it, expect, vi } from 'vitest';
import {
  canRead,
  buildOffRequest,
  DEFAULT_USER_AGENT,
  lookupOffProduct,
  normalizeOffCode,
  OFF_PRODUCT_URL,
  OFF_READ_LIMIT,
  OFF_WINDOW_MS,
  parseOffResponse,
} from '../../../supabase/functions/_shared/off.ts';
import { lookupOff, offResult, OFF_FUNCTION } from './off.js';

// The oat product as Open Food Facts answers it (the fields the app asks for).
const oatProduct = {
  code: '0036000291452',
  product_name: 'Rolled oats',
  product_name_en: 'Rolled oats',
  brands: 'Brand, Other',
  serving_size: '40 g',
  serving_quantity: 40,
  serving_quantity_unit: 'g',
  nutriments: {
    'energy-kcal_100g': 370,
    proteins_100g: 13,
    carbohydrates_100g: 60,
    fat_100g: 7,
    fiber_100g: 10,
    sugars_100g: 1,
    sodium_100g: 0.002,
  },
};

describe('normalizeOffCode (Edge Function helper)', () => {
  it('gives the same key for every zero-padded form, and the 13-digit Open Food Facts form', () => {
    for (const raw of ['036000291452', '0036000291452', '00036000291452']) {
      expect(normalizeOffCode(raw)).toEqual({ barcode: '36000291452', offCode: '0036000291452' });
    }
  });

  it('keeps an EAN-8 at 13 digits and a GTIN-14 at 14', () => {
    expect(normalizeOffCode('96385074')).toEqual({ barcode: '96385074', offCode: '0000096385074' });
    expect(normalizeOffCode('10036000291452')).toEqual({
      barcode: '10036000291452',
      offCode: '10036000291452',
    });
  });

  it('rejects anything that is not 8 to 14 digits', () => {
    expect(normalizeOffCode('1234567')).toBeNull();
    expect(normalizeOffCode('123456789012345')).toBeNull();
    expect(normalizeOffCode('abc')).toBeNull();
    expect(normalizeOffCode('00000000')).toBeNull();
  });
});

describe('canRead (the 15 reads a minute limit)', () => {
  const now = 1_000_000;

  it('allows a read while fewer than 15 fall inside the last minute', () => {
    const times = Array.from({ length: 14 }, (_, i) => now - i * 1000);
    expect(canRead(times, now)).toBe(true);
  });

  it('refuses the 16th read in a minute', () => {
    const times = Array.from({ length: OFF_READ_LIMIT }, (_, i) => now - i * 1000);
    expect(canRead(times, now)).toBe(false);
  });

  it('frees a slot once a read is a full minute old', () => {
    const times = Array.from({ length: OFF_READ_LIMIT }, () => now - OFF_WINDOW_MS);
    expect(canRead(times, now)).toBe(true);
    const almost = Array.from({ length: OFF_READ_LIMIT }, () => now - OFF_WINDOW_MS + 1);
    expect(canRead(almost, now)).toBe(false);
  });

  it('ignores reads recorded after now', () => {
    expect(canRead([now + 5000, now + 6000], now, 1)).toBe(true);
  });
});

describe('buildOffRequest and parseOffResponse', () => {
  it('asks the product endpoint with the User-Agent header and a field list', () => {
    const request = buildOffRequest('0036000291452', 'CalorieManager/1.0 (test)');
    expect(request.url.startsWith(`${OFF_PRODUCT_URL}0036000291452.json?fields=`)).toBe(true);
    expect(request.url).toContain('nutriments');
    expect(request.init.headers['User-Agent']).toBe('CalorieManager/1.0 (test)');
    expect(request.init.method).toBe('GET');
  });

  it('uses a default User-Agent that names the app and a contact', () => {
    expect(DEFAULT_USER_AGENT).toMatch(/^CalorieManager\/\d+\.\d+ \(.+\)$/);
  });

  it('reads status 1 as a product and anything else as not found', () => {
    expect(parseOffResponse({ status: 1, product: oatProduct })).toEqual({
      status: 'found',
      product: oatProduct,
    });
    expect(parseOffResponse({ status: 0, status_verbose: 'product not found' })).toEqual({
      status: 'notFound',
    });
    expect(parseOffResponse(null)).toEqual({ status: 'notFound' });
  });
});

// Fakes for lookupOffProduct: an in-memory store, a read log, a clock and a fetch.
function fakeDeps({
  stored = null,
  reads = [],
  status = 200,
  body,
  fetchError,
  now = 5_000_000,
} = {}) {
  const store = new Map(stored ? [[stored.barcode, stored]] : []);
  const readLog = [...reads];
  const deps = {
    now: () => now,
    recentReads: vi.fn(async () => readLog.filter((time) => now - time < OFF_WINDOW_MS)),
    recordRead: vi.fn(async (at) => {
      readLog.push(at);
    }),
    storedProduct: vi.fn(async (barcode) => store.get(barcode) ?? null),
    saveProduct: vi.fn(async (barcode, offCode, product) => {
      store.set(barcode, { barcode, offCode, product });
    }),
    fetchImpl: vi.fn(async () => {
      if (fetchError) throw fetchError;
      return { ok: status >= 200 && status < 300, status, json: async () => body };
    }),
    userAgent: 'CalorieManager/1.0 (test)',
  };
  return { deps, store, readLog };
}

describe('lookupOffProduct', () => {
  it('rejects a value that is not a code without reading anything', async () => {
    const { deps } = fakeDeps();
    expect(await lookupOffProduct('nope', deps)).toEqual({ status: 'invalid' });
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it('answers a stored product without a read, and never fetches it again', async () => {
    const { deps } = fakeDeps({
      stored: { barcode: '36000291452', offCode: '0036000291452', product: oatProduct },
    });
    const outcome = await lookupOffProduct('0036000291452', deps);
    expect(outcome).toMatchObject({ status: 'found', barcode: '36000291452', product: oatProduct });
    expect(deps.recordRead).not.toHaveBeenCalled();
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it('fetches with the User-Agent, stores the product unmodified and records the read', async () => {
    const { deps, store, readLog } = fakeDeps({
      status: 200,
      body: { status: 1, product: oatProduct },
    });
    const outcome = await lookupOffProduct('036000291452', deps);
    expect(outcome.status).toBe('found');
    expect(outcome.offCode).toBe('0036000291452');
    const [url, init] = deps.fetchImpl.mock.calls[0];
    expect(url).toContain('/product/0036000291452.json');
    expect(init.headers['User-Agent']).toBe('CalorieManager/1.0 (test)');
    expect(store.get('36000291452').product).toEqual(oatProduct);
    expect(readLog).toHaveLength(1);
  });

  it('refuses without fetching once 15 reads were made in the last minute', async () => {
    const now = 5_000_000;
    const reads = Array.from({ length: OFF_READ_LIMIT }, () => now - 10);
    const { deps, store } = fakeDeps({ reads, now });
    expect(await lookupOffProduct('036000291452', deps)).toEqual({ status: 'rateLimited' });
    expect(deps.fetchImpl).not.toHaveBeenCalled();
    expect(store.size).toBe(0);
  });

  it('answers not found for a code Open Food Facts does not have, and stores nothing', async () => {
    const { deps, store } = fakeDeps({ body: { status: 0 } });
    expect(await lookupOffProduct('036000291452', deps)).toEqual({ status: 'notFound' });
    expect(store.size).toBe(0);
  });

  it('answers unavailable on an HTTP error, a network error or an unreadable answer', async () => {
    const httpError = await lookupOffProduct('036000291452', fakeDeps({ status: 503 }).deps);
    expect(httpError).toEqual({
      status: 'unavailable',
      reason: 'Open Food Facts answered HTTP 503',
    });
    const network = await lookupOffProduct(
      '036000291452',
      fakeDeps({ fetchError: new Error('offline') }).deps
    );
    expect(network).toEqual({ status: 'unavailable', reason: 'offline' });
    const broken = fakeDeps({ status: 200 });
    broken.deps.fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('bad json');
      },
    }));
    expect((await lookupOffProduct('036000291452', broken.deps)).status).toBe('unavailable');
  });
});

describe('offResult', () => {
  it('maps a product to a result with per-100 g values, a serving and the source off', () => {
    const result = offResult({ barcode: '36000291452', product: oatProduct });
    expect(result).toEqual({
      key: 'off:36000291452',
      source: 'off',
      id: null,
      usdaId: null,
      offBarcode: '36000291452',
      name: 'Rolled oats',
      nameEs: null,
      nameEsEdited: false,
      brand: 'Brand',
      kcalPer100g: 370,
      macros: { protein: 13, carbs: 60, fat: 7, fibre: 10, sugars: 1, sodium: 2 },
      servingGrams: 40,
      servingLabel: '40 g',
    });
  });

  it('works out kcal from kJ when no kcal value is given', () => {
    const result = offResult({
      barcode: '1',
      product: { product_name: 'Soup', nutriments: { energy_100g: 418.4 } },
    });
    expect(result.kcalPer100g).toBe(100);
  });

  it('leaves missing values null, not zero, and gives no serving in a unit the app does not use', () => {
    const result = offResult({
      barcode: '1',
      product: {
        product_name: 'Tin',
        nutriments: {},
        serving_quantity: 1,
        serving_quantity_unit: 'cup',
      },
    });
    expect(result.kcalPer100g).toBeNull();
    expect(result.macros).toEqual({
      protein: null,
      carbs: null,
      fat: null,
      fibre: null,
      sugars: null,
      sodium: null,
    });
    expect(result.servingGrams).toBeNull();
    expect(result.brand).toBeNull();
  });

  it('falls back from the English name to the barcode', () => {
    expect(offResult({ barcode: '9', product: { product_name: '' } }).name).toBe('Barcode 9');
  });
});

describe('lookupOff (the app side)', () => {
  it('asks the off-lookup function with the code and returns a found result', async () => {
    const client = {
      functions: {
        invoke: vi.fn(async () => ({
          data: {
            status: 'found',
            barcode: '36000291452',
            offCode: '0036000291452',
            product: oatProduct,
          },
          error: null,
        })),
      },
    };
    const outcome = await lookupOff(client, '036000291452');
    expect(client.functions.invoke).toHaveBeenCalledWith(OFF_FUNCTION, {
      body: { code: '036000291452' },
    });
    expect(outcome.status).toBe('found');
    expect(outcome.result.source).toBe('off');
  });

  it('says rate limited and unavailable as offStatus, and not found as plain not found', async () => {
    const answer = (data) => ({
      functions: { invoke: vi.fn(async () => ({ data, error: null })) },
    });
    expect(await lookupOff(answer({ status: 'rateLimited' }), '1')).toEqual({
      status: 'notFound',
      offStatus: 'rateLimited',
    });
    expect(await lookupOff(answer({ status: 'unavailable', reason: 'x' }), '1')).toEqual({
      status: 'notFound',
      offStatus: 'unavailable',
    });
    expect(await lookupOff(answer({ status: 'notFound' }), '1')).toEqual({ status: 'notFound' });
    expect(await lookupOff(answer({ status: 'translated' }), '1')).toEqual({
      status: 'notFound',
      offStatus: 'unavailable',
    });
  });

  it('throws when the call itself fails', async () => {
    const client = {
      functions: { invoke: vi.fn(async () => ({ data: null, error: new Error('down') })) },
    };
    await expect(lookupOff(client, '1')).rejects.toThrow('down');
  });
});
