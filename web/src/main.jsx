import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.jsx';
import BarcodeTest from './components/BarcodeTest.jsx';
import InstallHint from './components/InstallHint.jsx';
import { I18nProvider } from './i18n/I18nProvider.jsx';
import { ActingMemberProvider } from './lib/actingMember.jsx';
import { UnitsProvider } from './lib/useUnits.jsx';
import { registerServiceWorker } from './lib/registerServiceWorker.js';
import { wantsBarcodeTest } from './lib/barcodeTestRoute.js';

registerServiceWorker();

// ?test=barcode opens the hidden barcode test screen instead of the app.
const screen = wantsBarcodeTest(window.location) ? (
  <BarcodeTest />
) : (
  <I18nProvider>
    <ActingMemberProvider>
      <UnitsProvider>
        <App />
      </UnitsProvider>
    </ActingMemberProvider>
    <InstallHint />
  </I18nProvider>
);

createRoot(document.getElementById('root')).render(<StrictMode>{screen}</StrictMode>);
