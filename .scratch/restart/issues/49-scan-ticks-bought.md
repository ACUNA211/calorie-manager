# 49: Scan ticks Bought

**What to build:** A Scan button on the Shopping list: scanning a product ticks its line as Bought and adds the real package size to the Pantry instead of the planned amount. A product with no line is added to the Pantry with a note.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 47 (Bought / Have it), 18 (Scan finds a food), 105 (Phone check: scanning on the Shopping list)

**Status:** done (awaiting phone test)

- [ ] Scanning a product on the list ticks its line and adds the package weight
- [x] Scanning something not on the list asks to add it to the Pantry
- [x] Works with the lookups from tickets 18–20

## Comments

- 2026-10-19: Built on branch restart-t49. Scan button on the Shopping list (`web/src/components/ShoppingScan.jsx`, mounted in `ShoppingPage.jsx` above the add form). It reads the code with `ScanPanel` and the same `lookupGtin` as ticket 18 (Food Library, USDA, then Open Food Facts); a USDA-only hit is saved to the Food Library first. `lib/shoppingScan.js` (pure) picks the open line of that food: the planned line before a "+ extra" line, then the oldest; ticked and unsent lines are skipped. A match ticks Bought through the page's one tick call (`useOfflineShopping.tick(lineId, 'bought', grams)`, so it queues offline) with the package weight from `packageGrams` (the weight set on the food, else a package serving; asked once and saved with `set_package_grams` when unknown, as ticket 26 does). No open line: the app asks, then adds one package with `pantry_add` and says it was not on the list (the "note" is that on-screen message; the Pantry has no note column, so no migration). A food whose lines are all ticked gets the same offer, worded "already ticked". Not found: message, scan again, and Type in the label (ticket 20) only when no source knows the code; Open Food Facts busy or down says try again. An Open Food Facts-only product is shown with its credit but not ticked or added (ticket 85). Scan is disabled with no connection (lookups need one). No migration. Measured in `web/`: `npm run lint`, `npm run build`, `npm run format:check` pass; `npm test` 100 files, 1305 tests pass (also with `--maxWorkers=2`; one default-parallelism run had one failure I did not capture, the next two runs passed). New: `shoppingScan.test.js` (9), `ShoppingScan.test.jsx` (14, camera and reader faked, backend a fake). Box 1 NOT ticked: it needs the real `shopping_tick` (migration 046, tests not yet run, ticket 98) and a phone camera. Boxes 2 and 3 are ticked from the faked-backend component tests only; real camera reading is ticket 75.
