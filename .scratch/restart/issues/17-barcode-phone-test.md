# 17: Barcode phone test

**What to build:** Port the old barcode test page into the app as a hidden test screen using the `barcode-detector` polyfill built on zxing-wasm (self-host the .wasm file). It opens the rear camera, reads UPC-A, UPC-E, EAN-13 and EAN-8, and shows the code. Run it on both Household Android phones and one iPhone (installed app), and write down the results.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 03 (Home Screen install and offline app shell), 75 (Phone check: barcode reads)

**Status:** done

- [x] The test screen reads a UPC-A and an EAN-13 from real packages
- [x] Uses the native `BarcodeDetector` where it works and the zxing-wasm polyfill otherwise
- [x] Results (phone, browser, read time, misses) recorded in the ticket's comments
- [x] The old `@zxing/library` dependency isn't used

## Comments

- 2026-10-17: Built in worktree `restart-t17` under `web/`. Hidden screen `web/src/components/BarcodeTest.jsx`, opened with `?test=barcode` (routed in `web/src/main.jsx`, so the app and sign-in are untouched). Engine choice in `web/src/lib/barcodeEngine.js` (native only if it lists all four formats, else polyfill; unit tested with a mocked BarcodeDetector). Polyfill loader in `web/src/lib/barcodeDetector.js`: `barcode-detector` 3.2.2 with `zxing-wasm` pinned to 3.1.3, its `.wasm` imported as an asset so Vite emits it under `dist/assets/` and it is in the service worker precache (`globPatterns` in `web/vite.config.js` now includes `wasm`; about 1.09 MB, so the first online visit downloads it). No CDN, and `@zxing/library` is not used by the new code (the old `app/barcode-test.html` still loads it, untouched). Rear camera via `facingMode: environment`. Results log is on screen with a Copy button. `npm run lint`, `build`, `test` (14 tests, 6 of them for the engine choice) and `format:check` pass. Not ticked: nothing was run on a phone, so the real-package read box is open.
- To run it: deploy or `npm run build && npx vite preview`, then open `https://<site>/?test=barcode` (camera needs HTTPS or localhost). In `npm run dev` use `http://localhost:5173/?test=barcode`. The installed Home Screen app starts at `/`, so on iPhone open the same URL in Safari (not the installed icon). Tap "Start camera", allow the camera, point it at a package; each read is logged with format, engine and time since the previous read.
- Phone test, to fill in (one row per package, or per phone if you prefer):

| Phone | Browser | Package (UPC-A / UPC-E / EAN-13 / EAN-8) | Engine shown | Read time (ms) | Misses (tries before a read) | Notes |
|---|---|---|---|---|---|---|
| Household Android 1 | | | | | | |
| Household Android 2 | | | | | | |
| iPhone (Safari) | | | | | | |
- 2026-10-18: Phone test done (ticket 75): UPC-A and EAN-13 read from real packages on both Household Android phones and the iPhone. The table above was left blank: Sergio chose not to record per-phone read times and misses.
