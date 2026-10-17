import { registerSW } from 'virtual:pwa-register';

// Registers the offline service worker that vite-plugin-pwa generates.
// Registration is skipped in dev (the plugin's dev mode is off), so this only
// does something in a production build.
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  registerSW({ immediate: true });
}
