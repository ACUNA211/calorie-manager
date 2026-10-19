# 32: Weight log and trend

**What to build:** A Member can log their weight (in their units) and see a trend line on the Week view covering the last 12 weeks. Weight is private to the Member unless they share everything (ticket 33).

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 31 (Week view), 69 (Run the database tests locally)

**Status:** done (awaiting review)

- [x] Log, edit and delete a weight entry
- [x] The Week view shows a trend line over the last 12 weeks
- [x] Other Members can't read your weight (policy test)

## Comments

- 2026-10-17: Built in worktree `t32` (branch `restart-t32`). Migration `030_weight_log.sql`: table `weight_log`, one row per Member per day (unique on member and day), `kg numeric(4,1)` checked between 20 and 400. RLS reads go through `private.weight_readable_by_caller(member_id)`, which is true for the Member and for the Dependents of the caller's Household (from `private.my_member_ids()`, migration 007), so other adults see nothing. Writes use the same member check. Hook for ticket 33: that read function is where the "share everything" switch widens reads; writes never widen. pgTAP test `supabase/tests/weight_log_test.sql` (21 assertions, NOT run; ticket 69).
- 2026-10-17: Units: weight is stored in kg and the screens show kg for now. The kg-to-lb helpers (`kgToLb`, `lbToKg` in `web/src/lib/weightLogic.js`) are used only by tests; ticket 11 should swap the display to the shared formatter and use these helpers for the lb input.
- 2026-10-17: Web: `lib/weight.js` (load, upsert, delete), `lib/weightLogic.js` (parse and check, 7-day moving average, 12-week window, chart geometry), `components/WeightPanel.jsx` (log, edit, delete, list) and `components/WeightTrend.jsx` (inline SVG line, no chart library), rendered at the foot of `WeekPage.jsx` and acting for the picked Member. Locale namespace `weight` in en and es. Logging a day that already has a weight replaces it. Weight logging is online only (not in the offline queue). The trend covers the 12 weeks ending with the week on screen.
- 2026-10-17: Measured in `web/`: `npm run lint` passes (exit 0); `npm run format:check` passes; `npm run build` passes (exit 0); `npm test` 56 files, 787 tests pass. New tests: `weightLogic.test.js`, `weight.test.js`, `WeightPanel.test.jsx`, plus one case in `WeekPage.test.jsx`. They use a fake Supabase client and fixed dates; nothing ran against a database or in a browser.
- 2026-10-17: Ticked the first two boxes on Vitest evidence only. Not ticked: the policy box, because the pgTAP test has not run (ticket 69). Not verified: the database and RLS (pgTAP), the policy for a real adult Member, and the chart's layout on a phone.
- 2026-10-18: `supabase db reset` (001–033) and `supabase test db` run on the local stack: 22 files, 387 tests, all pass.
