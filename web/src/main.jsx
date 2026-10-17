import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import InstallHint from './components/InstallHint.jsx';
import { registerServiceWorker } from './lib/registerServiceWorker.js';

registerServiceWorker();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <InstallHint />
  </StrictMode>
);
