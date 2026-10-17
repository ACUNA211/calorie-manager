// Formats the barcode test screen reads (the grocery and EAN family).
export const BARCODE_FORMATS = ['upc_a', 'upc_e', 'ean_13', 'ean_8'];

// Picks the reader for this phone. The native BarcodeDetector is used only when
// it reports every format we need; otherwise the zxing-wasm polyfill is used.
// NativeDetector is passed in (globalThis.BarcodeDetector in the app) so tests can mock it.
export async function chooseBarcodeEngine(NativeDetector) {
  if (typeof NativeDetector !== 'function') return 'polyfill';
  if (typeof NativeDetector.getSupportedFormats !== 'function') return 'polyfill';
  try {
    const supported = await NativeDetector.getSupportedFormats();
    return BARCODE_FORMATS.every((format) => supported.includes(format)) ? 'native' : 'polyfill';
  } catch {
    return 'polyfill';
  }
}
