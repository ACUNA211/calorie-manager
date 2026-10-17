# 27: Today scan buttons: Add to Pantry / Eaten

**What to build:** A Scan button on Today: the scanned food is shown with two buttons. **Add to Pantry** adds the package (as in ticket 26). **Eaten** logs it at the current Meal Time (with an amount picker) and, if the food is in the Pantry, takes that amount off the Pantry.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 23 (Today: log a food), 25 (Pantry page), 18 (Scan finds a food), 75 (Phone check: barcode reads), 69 (Run the database tests locally), 84 (Decide: Today logging rules)

**Status:** done (awaiting phone test)

- [x] Both buttons appear after a scan on Today
- [ ] Eaten logs at the current Meal Time with calories and macros
- [x] Eaten takes the amount off the Pantry when the food is there, and doesn't fail when it isn't
- [ ] Undo reverses both the log and the Pantry change

## Comments

- 2026-10-17: Built in worktree `t27` (branch `restart-t27`), committed locally, not pushed. Scan button on Today: `web/src/components/TodayScan.jsx` (rendered by `TodayPage.jsx` next to Log food, with `handleScanEaten` giving one Undo toast for both writes). Pure rules and writes in `web/src/lib/todayScan.js` (`eatenRow`, `eatFood`, `undoEat`, `packageToAdd`, `addPackageWithWeight`, `canActOnScan`). Eaten writes the Calorie Log row first, then calls `pantry_take` (migration `supabase/migrations/029_pantry_take.sql`: takes up to the amount under a row lock, never below zero, returns 0 when the food is not in the Pantry). If the Pantry step fails the log stays and the toast says so. Undo deletes the entry and puts back exactly the grams taken (`pantry_add`). Eaten needs a connection (the Pantry change is not queued offline). Open Food Facts results show both buttons disabled with a note (ticket 85). Locale keys under `today.scan` in en and es. pgTAP test `supabase/tests/pantry_take_test.sql` (9 checks), **not run** (ticket 69). Measured in `web/`: `npm run lint` passes; `npm run build` passes; `npm run format:check` passes; `npm test` 55 files, 782 tests pass. New tests: `todayScan.test.js` and `TodayScan.test.jsx` (fake Supabase, mocked lookup and camera). Box 2 is left unticked: the component test checks calories and the Eaten call, and the macro figures are checked in `todayScan.test.js`, but no test checks which Meal Time the default picks on screen. Box 4 is left unticked: Undo is tested as the function (`undoEat`), not through the toast on the Today page. Nothing ran against a real database, a browser or a phone.
