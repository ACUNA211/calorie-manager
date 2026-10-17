// Open Food Facts lookup for Scan (ticket #19, ADR 0002, ADR 0003). Pure: no Deno APIs and
// no database. The Edge Function (off-lookup/index.ts) supplies the fetch function, the
// clock and the database; the web app's tests supply fakes for all of them.
//
// API used: GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json (see
// https://openfoodfacts.github.io/openfoodfacts-server/api/ for the product endpoint, the
// required custom User-Agent "AppName/Version (ContactEmail)" and the limit of 15 product
// reads per minute per IP address). The data is ODbL: products are stored exactly as
// returned, in off_products, and the app shows an "Open Food Facts" credit with a link.

export const OFF_PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product/';
// Only the fields the app shows or the credit needs. The product is stored as returned.
export const OFF_FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'generic_name',
  'brands',
  'serving_size',
  'serving_quantity',
  'serving_quantity_unit',
  'nutriments',
].join(',');
// Open Food Facts asks for a name and a contact. Set OFF_USER_AGENT as a secret to change it.
export const DEFAULT_USER_AGENT =
  'CalorieManager/1.0 (https://github.com/ACUNA211/calorie-manager)';
export const OFF_READ_LIMIT = 15;
export const OFF_WINDOW_MS = 60_000;
export const OFF_TIMEOUT_MS = 8_000;

export type OffOutcome =
  | { status: 'found'; barcode: string; offCode: string; product: Record<string, unknown> }
  | { status: 'notFound' }
  | { status: 'rateLimited' }
  | { status: 'invalid' }
  | { status: 'unavailable'; reason: string };

export interface OffCode {
  // The key every form of one product shares: digits with leading zeros removed.
  barcode: string;
  // The code as Open Food Facts keys its products: 13 digits (14 for a GTIN-14).
  offCode: string;
}

// A scanned code (8 to 14 digits, any zero padding) as the key and the Open Food Facts form.
// Returns null when the value is not a code of that length.
export function normalizeOffCode(raw: unknown): OffCode | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  const barcode = digits.replace(/^0+/, '');
  if (barcode === '') return null;
  const length = barcode.length > 13 ? 14 : 13;
  return { barcode, offCode: barcode.padStart(length, '0') };
}

// True when the times (epoch milliseconds) hold fewer than `limit` reads inside the window
// ending at `now`. A read at exactly the window's start has just left the window.
export function canRead(
  times: number[],
  now: number,
  limit: number = OFF_READ_LIMIT,
  windowMs: number = OFF_WINDOW_MS
): boolean {
  const inWindow = times.filter((time) => time <= now && now - time < windowMs).length;
  return inWindow < limit;
}

export function buildOffRequest(
  offCode: string,
  userAgent: string
): { url: string; init: { method: 'GET'; headers: Record<string, string> } } {
  const params = new URLSearchParams({ fields: OFF_FIELDS });
  return {
    url: `${OFF_PRODUCT_URL}${encodeURIComponent(offCode)}.json?${params.toString()}`,
    init: {
      method: 'GET',
      headers: { 'User-Agent': userAgent, Accept: 'application/json' },
    },
  };
}

// Open Food Facts answers status 1 with a product, or status 0 when it has no such code.
export function parseOffResponse(
  json: unknown
): { status: 'found'; product: Record<string, unknown> } | { status: 'notFound' } {
  const body = json as { status?: unknown; product?: unknown } | null;
  if (body && body.status === 1 && body.product && typeof body.product === 'object') {
    return { status: 'found', product: body.product as Record<string, unknown> };
  }
  return { status: 'notFound' };
}

export interface StoredProduct {
  offCode: string;
  product: Record<string, unknown>;
}

// Stops a slow answer from Open Food Facts holding the scan up.
function timeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(OFF_TIMEOUT_MS)
    : undefined;
}

// The dependencies a lookup needs. The Edge Function passes the real ones.
export interface OffDeps {
  now: () => number;
  // Times (epoch ms) of the product reads made in the last window.
  recentReads: () => Promise<number[]>;
  recordRead: (at: number) => Promise<void>;
  storedProduct: (barcode: string) => Promise<StoredProduct | null>;
  saveProduct: (
    barcode: string,
    offCode: string,
    product: Record<string, unknown>
  ) => Promise<void>;
  fetchImpl: (
    url: string,
    init: { method: 'GET'; headers: Record<string, string> },
    signal: AbortSignal | undefined
  ) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
  userAgent: string;
}

// Looks a code up: the stored product first (no read used), then Open Food Facts within the
// read limit. Only a found product is stored; a miss or an error is answered, not kept.
export async function lookupOffProduct(raw: unknown, deps: OffDeps): Promise<OffOutcome> {
  const code = normalizeOffCode(raw);
  if (code === null) return { status: 'invalid' };

  const stored = await deps.storedProduct(code.barcode);
  if (stored) {
    return {
      status: 'found',
      barcode: code.barcode,
      offCode: stored.offCode,
      product: stored.product,
    };
  }

  const now = deps.now();
  if (!canRead(await deps.recentReads(), now)) return { status: 'rateLimited' };
  await deps.recordRead(now);

  const request = buildOffRequest(code.offCode, deps.userAgent);
  let response;
  try {
    response = await deps.fetchImpl(request.url, request.init, timeoutSignal());
  } catch (error) {
    return {
      status: 'unavailable',
      reason: error instanceof Error ? error.message : 'Open Food Facts could not be reached',
    };
  }
  if (!response.ok) {
    return { status: 'unavailable', reason: `Open Food Facts answered HTTP ${response.status}` };
  }

  let parsed;
  try {
    parsed = parseOffResponse(await response.json());
  } catch {
    return { status: 'unavailable', reason: 'Open Food Facts sent an unreadable answer' };
  }
  if (parsed.status === 'notFound') return { status: 'notFound' };

  await deps.saveProduct(code.barcode, code.offCode, parsed.product);
  return {
    status: 'found',
    barcode: code.barcode,
    offCode: code.offCode,
    product: parsed.product,
  };
}
