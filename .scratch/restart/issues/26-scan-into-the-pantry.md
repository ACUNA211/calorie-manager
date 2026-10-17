# 26: Scan into the Pantry

**What to build:** A Scan button on the Pantry: scanning a package adds one package to the Pantry at its label weight (the food's package or serving data), using the same lookup as ticket 18.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 25 (Pantry page), 18 (Scan finds a food), 75 (Phone check: barcode reads), 69 (Run the database tests locally)

**Status:** done (awaiting phone test)

- [ ] Scanning a known product adds one package at its label weight
- [ ] Scanning the same product again adds another package
- [ ] If the package weight is unknown, ask for it once and remember it on the food

## Comments

- 2026-10-17: Built in worktree `restart-t26` (branch `restart-t26`). Scan button on the Pantry (`web/src/components/PantryScan.jsx`, with `PantryPage.jsx` rendering it above the add form). It reads the code through `ScanPanel` and the same `lookupGtin` as the Foods screen (ticket 18); a USDA-only hit is saved to the Food Library first (`foodIdFor`, as adding by search does). Package weight: `packageGrams` in `web/src/lib/pantryLogic.js` takes the weight the Household set on the food, else a serving whose label names a package (can, bottle, package, and so on); a plain serving such as "1 cup" is not taken for the package. When it is unknown, the app asks once and saves it with `set_package_grams` (migration `supabase/migrations/027_food_package_grams.sql`: new `foods.package_grams` column, Member-callable function scoped to the caller's Household). Not found shows the message and offers search by name. pgTAP test `supabase/tests/package_grams_test.sql`, **not run** (no local Supabase; ticket 69). Checks: `npm run lint` clean, `npm run build` ok, `npm run format:check` clean, `npm test` 44 files / 628 tests pass on the second run (the first run had four 5-second timeouts under load (RecipeEditor was one; I did not record the other three)). The 17 new tests: `PantryScan.test.jsx` (7), `pantryLogic.test.js` (6), `pantry.test.js` (4); the camera and barcode reader are mocked and the backend is a fake. Not ticked: the two scan boxes and the weight box are verified only against the fake backend, not the real database or a phone; the phone camera read is ticket 75.
