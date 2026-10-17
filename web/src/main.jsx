import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import InstallHint from './components/InstallHint.jsx';
import { I18nProvider } from './i18n/I18nProvider.jsx';
import { registerServiceWorker } from './lib/registerServiceWorker.js';

registerServiceWorker();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <App />
      <InstallHint />
    </I18nProvider>
  </StrictMode>
);
