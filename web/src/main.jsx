import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import BarcodeTest from './components/BarcodeTest.jsx';
import InstallHint from './components/InstallHint.jsx';
import { registerServiceWorker } from './lib/registerServiceWorker.js';
import { wantsBarcodeTest } from './lib/barcodeTestRoute.js';

registerServiceWorker();

// ?test=barcode opens the hidden barcode test screen instead of the app.
const screen = wantsBarcodeTest(window.location) ? (
  <BarcodeTest />
) : (
  <>
    <App />
    <InstallHint />
  </>
);

createRoot(document.getElementById('root')).render(<StrictMode>{screen}</StrictMode>);
