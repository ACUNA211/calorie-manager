# 03: Home Screen install and offline app shell

**What to build:** Make the app an installable PWA: a web app manifest (name, icons, theme colour) and a service worker that caches the app shell, so it opens with no signal and can be added to the Home Screen on Android (Chrome) and iPhone (Safari, iOS 16.4+). On iPhone, show a one-time hint explaining Share → Add to Home Screen, because push reminders later only work when installed.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 02 (App skeleton and sign-in)

**Status:** done (awaiting device check)

- [ ] Lighthouse (or Chrome DevTools) reports the app as installable
- [ ] With the network off, an installed app still opens to its shell instead of a browser error
- [ ] On iPhone Safari (not installed), a dismissable "Add to Home Screen" hint appears once
- [ ] A new deploy is picked up on next open (no stale shell forever)

## Comments

- 2026-10-17: Built in worktree `restart-t03` under `web/`. vite-plugin-pwa 2.0.0 (generateSW, `autoUpdate` with skipWaiting and clientsClaim, so a new deploy takes over on the next open) precaches the shell: HTML, JS, CSS, manifest and icons, with a navigation fallback to `index.html`. Manifest name "Calorie Manager", theme `#2e7d32`; icons 192, 512, maskable 512 and a 180 apple-touch-icon in `web/public/`, drawn by a script (not kept in the repo). Registration lives in `web/src/lib/registerServiceWorker.js`; the iPhone hint is `web/src/components/InstallHint.jsx` (logic in `web/src/lib/installHint.js`, dismissal in localStorage behind try/catch). The hint shows on iPhone Safari only (not iPad, not other browsers, not standalone) until "Got it" is tapped. `npm run lint`, `build`, `test` (8 tests, 7 of them for the hint) and `format:check` pass. `npx vite preview` served the manifest, `sw.js` and the icons. Not ticked: none of the four boxes were checked on a device or in Lighthouse.
- To check on a device: (1) Lighthouse or Chrome DevTools > Application reports installable, on the deployed Pages URL; (2) load the app once online, then turn the network off and reopen the installed app: it should show the shell, not a browser error (sign-in itself needs a connection); (3) on an iPhone in Safari (iOS 16.4+) the hint appears once at the bottom, and stays gone after "Got it" and after a reload; it is not shown when opened from the Home Screen; (4) after a new deploy, the next open runs the new version (check the build hash or a visible change). Note: the build needs the `VITE_` variables, as in ticket 02.
