// The barcode test screen is hidden: open the app with ?test=barcode to see it.
export function wantsBarcodeTest(location) {
  return new URLSearchParams(location.search).get('test') === 'barcode';
}
