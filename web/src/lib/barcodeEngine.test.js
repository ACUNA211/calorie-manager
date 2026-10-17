import { describe, it, expect, vi, afterEach } from 'vitest';
import { chooseBarcodeEngine } from './barcodeEngine.js';

function nativeWith(formats) {
  const NativeDetector = vi.fn();
  NativeDetector.getSupportedFormats = vi.fn(async () => formats);
  return NativeDetector;
}

describe('chooseBarcodeEngine', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the polyfill when the browser has no BarcodeDetector', async () => {
    expect(await chooseBarcodeEngine(undefined)).toBe('polyfill');
    expect(await chooseBarcodeEngine(null)).toBe('polyfill');
  });

  it('uses the native detector when it reads all four formats', async () => {
    const native = nativeWith(['upc_a', 'upc_e', 'ean_13', 'ean_8', 'qr_code']);
    expect(await chooseBarcodeEngine(native)).toBe('native');
  });

  it('uses the polyfill when the native detector misses one format', async () => {
    const native = nativeWith(['upc_a', 'ean_13', 'ean_8']);
    expect(await chooseBarcodeEngine(native)).toBe('polyfill');
  });

  it('uses the polyfill when the native detector cannot list its formats', async () => {
    const NativeDetector = vi.fn();
    expect(await chooseBarcodeEngine(NativeDetector)).toBe('polyfill');
  });

  it('uses the polyfill when listing the native formats fails', async () => {
    const NativeDetector = vi.fn();
    NativeDetector.getSupportedFormats = vi.fn(async () => {
      throw new Error('not allowed');
    });
    expect(await chooseBarcodeEngine(NativeDetector)).toBe('polyfill');
  });

  it('reads the browser global when it is passed in', async () => {
    vi.stubGlobal('BarcodeDetector', nativeWith(['upc_a', 'upc_e', 'ean_13', 'ean_8']));
    expect(await chooseBarcodeEngine(globalThis.BarcodeDetector)).toBe('native');
  });
});
