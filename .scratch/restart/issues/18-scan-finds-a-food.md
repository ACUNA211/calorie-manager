# 18: Scan finds a food

**What to build:** A Scan button on the Foods screen: camera → barcode → the existing GTIN lookup (Food Library first, then USDA Branded) → the food is shown with calories and macros, ready to save. If nothing matches, say so and offer search (tickets 19 and 20 add the fallbacks).

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 14 (Food search page), 17 (Barcode phone test), 75 (Phone check: barcode reads)

**Status:** done (awaiting phone test)

- [ ] Scanning a known product shows it within a few seconds
- [ ] Scanning a product already in the Food Library doesn't call USDA
- [x] An unknown code shows "Not found" with a search button, never a dead end
- [x] The lookup tries the 12-digit and 13-digit forms of the code (tested with zero-padded codes)

## Comments

- 2026-10-17: Built in worktree `restart-t18` under `web/`. Scan button and camera panel on the Foods screen (`web/src/components/FoodsPage.jsx`, `web/src/components/ScanPanel.jsx`). The camera reads through `createBarcodeDetector` from ticket 17 and passes only codes that pass their check digit. Pure GTIN helpers in `web/src/lib/gtin.js` (zero-padded 12/13/14-digit forms). `lookupGtin` in `web/src/lib/foods.js` makes one call to `usda_lookup_gtin`: the database checks the Food Library first and asks USDA only on a miss, so a library hit makes no USDA call. A USDA-only hit shows calories and a Save button; macros appear after saving, as in the search list. Migration `023_scan_lookup_grant.sql` grants `usda_lookup_gtin` to `authenticated`: migration 003 revoked it and 006 did not restore it. Its pgTAP test is `supabase/tests/barcode_lookup_test.sql`, **not run** (no local Supabase here). Checks: `npm run lint` clean, `npm run build` ok, `npm test` 37 files / 518 tests pass (the three files this ticket adds or extends: `gtin.test.js`, `foods.test.js`, `FoodsScan.test.jsx`, 68 tests), `npm run format:check` clean. Not ticked: nothing ran on a phone or against a live database, so the "within a few seconds" box and the "library hit doesn't call USDA" box (the server-side short-circuit is read from the SQL, not run) stay open. The camera is mocked in tests.
- To check on a phone (ticket 75 covers the camera reads): open the app, tap "Scan a barcode" on Foods, scan a known product, then an unknown one, and note how long a known product takes to show.
