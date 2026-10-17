import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // The new service worker takes over as soon as it is installed, so the
      // next time the app is opened it runs the newest deploy (no stale shell).
      registerType: 'autoUpdate',
      // src/lib/registerServiceWorker.js registers the worker, so no script is injected here.
      injectRegister: false,
      includeAssets: ['apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        name: 'Calorie Manager',
        short_name: 'Calories',
        description: 'Household calorie and macro tracker with a weekly Meal Plan.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#2e7d32',
        background_color: '#ffffff',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the app shell: HTML, JS, CSS, the manifest and the icons.
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        // Any page navigation offline gets the cached shell.
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: false,
  },
});
