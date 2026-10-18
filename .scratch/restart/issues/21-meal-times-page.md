# 21: Meal Times page

**What to build:** Port the Meal Times week grid from the old app (rows are Meal Times, columns are weekdays; tap a cell to toggle a day, tap a name to edit) for the current Member. Kinds are Set (one number), Planned and If room (calorie ranges), as in `CONTEXT.md`. Day totals show under each column against the Calorie Target and band.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 09 (Move personal tables to Members), 72 (Decide: when do two Meal Times overlap?)

**Status:** done (awaiting review)

- [x] A Member can add, edit and delete Meal Times and toggle weekdays
- [x] Set needs one calorie number; Planned and If room need a range
- [x] Day totals show under each weekday against the Target and band
- [x] Overlapping times on the same day ask whether the new one replaces the other

## Comments

- 2026-10-17: Built the week grid in web/src/components/MealTimesPage.jsx, with pure rules in web/src/lib/mealTimesLogic.js and Supabase access in web/src/lib/mealTimes.js. Tested with Vitest (validation, day totals, overlap, a mocked client and the page). Lint, build, tests and format:check pass. Not run against a live database; no migration needed (007 already gives meal_times member_id and RLS). Overlap uses 45 minutes, as agreed in the mvp-reset prototype, not the exact same time this ticket first said. Target and band are shown read-only; ticket 10 edits them. Spanish kind names (Fijo, Planificado, Si hay espacio) are my choice, for review.
- 2026-10-17 (#72 decided): two Meal Times overlap only at the **exact same time** on the same day, not within 45 minutes. Change the overlap check (and its tests) to match. Spanish kind names Fijo, Planificado, Si hay espacio are approved.
- 2026-10-17 (#72 applied): overlap is now the exact same time on a shared weekday; tests updated. Tests: 911 passed in 67 files (npm test).
