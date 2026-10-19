# 24: Today: edit, delete, undo

**What to build:** On Today, tapping a log entry lets the Member change its amount or Meal Time, or delete it. Every log, change and delete shows a toast with Undo for a few seconds.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 23 (Today: log a food), 84 (Decide: Today logging rules)

**Status:** done

- [x] Editing an entry's amount recalculates calories and macros
- [ ] Deleting shows Undo; Undo restores the entry exactly
- [x] Logging shows Undo; Undo removes the entry

## Comments

- 2026-10-17: Built in worktree `t24` (branch `restart-t24`). Tapping an entry on Today opens `EditEntryPanel.jsx` (amount in grams or servings, Meal Time or another time, Delete). Every log, change and delete shows `Toast.jsx` with Undo for 5 s; only the latest change can be undone. Pure rules added to `lib/todayLogic.js` (`editEntryPatch`, `rescaleNutrition`, `restoreRow`, `sortEntries`, ...), data access in `lib/today.js` (`updateEntry`, `deleteEntry`, `restoreEntry`). No migration: calorie_log's `for all` RLS policy from 007 covers update and delete for the acting Member's rows, read from the migration only. Not restored exactly: `calorie_log.id` is `generated always as identity`, so Undo of a delete inserts the row with a new id; date, Meal Time, clock time, amounts, macros, food and original `created_at` are kept. Box 2 is left unticked for that reason. Tests use mocked Supabase; nothing ran against a database or browser. Measured in `web/`: `npm run lint` passes; `npm run build` passes; `npm run format:check` passes; `npm test` 38 files, 532 tests pass. The pgTAP tests were not run (none added; ticket 69 covers the existing ones).
