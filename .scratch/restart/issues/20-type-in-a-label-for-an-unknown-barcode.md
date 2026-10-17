# 20: Type in a label for an unknown barcode

**What to build:** When neither USDA nor Open Food Facts knows a barcode, the Member types in the Nutrition Facts label: name, brand, serving size in grams, calories and the six macros per serving. It's saved to the Food Library with that barcode, so the next scan finds it.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 18 (Scan finds a food), 69 (Run the database tests locally), 75 (Phone check: barcode reads), 81 (Decide: show macros on USDA search results?)

**Status:** done (awaiting DB test run)

- [x] The form converts per-serving values to per 100 g correctly (tested)
- [ ] The saved food has the scanned barcode, and scanning it again finds it straight away
- [ ] The food is marked as typed from a label
- [x] Validation stops obvious typos (calories far from 4·carb + 4·protein + 9·fat asks to confirm)

## Comments

- 2026-10-17: Built in worktree `restart-t20` under `web/` and `supabase/`. The form is `web/src/components/LabelForm.jsx`, opened by "Type in the label" on the Foods scan's not-found state (`web/src/components/FoodsPage.jsx`). The pure part is `web/src/lib/label.js`: per-serving values become per 100 g (`value × 100 ÷ serving grams`, one decimal), and the calorie check allows the larger of 10 kcal or 20 % of 4·carbs + 4·protein + 9·fat; a far-off total needs a second press ("Save anyway"). Blank fibre, sugars and sodium stay null. Ranges: serving 1 to 5000 g, calories 0 to 2000 per serving, each macro up to 500 g and no more than the serving, sugars not above carbs. Migration `supabase/migrations/028_label_foods.sql` adds `save_label_food` (granted to `authenticated` only): it saves into the caller's Household with `source = 'label'` (already allowed by 001) and the 14-digit barcode, and returns the existing food when the Household already has that barcode. `lookupGtin` results now carry `typedFromLabel`, shown as "Typed from a label, in your Food Library". "Type in the label" is offered only when Open Food Facts gave a clean "no", not when it was busy or down. pgTAP test `supabase/tests/label_foods_test.sql` (22 checks): **not run** (no local Supabase here). Checks: `npm run lint` clean; `npm run build` ok; `npm test` 55 files / 785 tests pass (new: `label.test.js`, `LabelForm.test.jsx`, two in `FoodsScan.test.jsx`, one in `foods.test.js`); `npm run format:check` clean. Three existing `FoodsPage.test.jsx` fixtures used `source: 'label'` for a plain library food; changed to `'estimated'`. Not ticked: the database half (what `save_label_food` writes, and the second scan answered by the library in SQL) is untested, and the scan-again check runs against a fake backend only. Phone check not done (ticket 75).
