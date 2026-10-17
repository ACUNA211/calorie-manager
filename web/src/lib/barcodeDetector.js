import zxingWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { BARCODE_FORMATS, chooseBarcodeEngine } from './barcodeEngine.js';

let polyfillPromise = null;

// Loads the barcode-detector polyfill once. Its zxing-wasm binary is served from
// our own build (precached by the service worker), not from the default CDN.
function loadPolyfill() {
  if (!polyfillPromise) {
    polyfillPromise = import('barcode-detector/ponyfill').then(
      ({ BarcodeDetector, prepareZXingModule }) => {
        prepareZXingModule({
          overrides: {
            locateFile: (path, prefix) => (path.endsWith('.wasm') ? zxingWasmUrl : prefix + path),
          },
        });
        return BarcodeDetector;
      }
    );
  }
  return polyfillPromise;
}

// Returns { engine, detector } where engine is 'native' or 'polyfill'.
// detector.detect(videoElement) resolves to [{ rawValue, format, ... }].
export async function createBarcodeDetector() {
  const engine = await chooseBarcodeEngine(globalThis.BarcodeDetector);
  if (engine === 'native') {
    return { engine, detector: new globalThis.BarcodeDetector({ formats: BARCODE_FORMATS }) };
  }
  const PolyfillDetector = await loadPolyfill();
  return { engine, detector: new PolyfillDetector({ formats: BARCODE_FORMATS }) };
}
