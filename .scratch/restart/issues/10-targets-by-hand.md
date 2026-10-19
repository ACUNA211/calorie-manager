# 10: Targets by hand

**What to build:** A Targets screen per Member to type in their Targets from `CONTEXT.md`: Calorie Target (a ceiling), protein floor (grams), optional carb and fat ranges (grams), and the Planning band (percent of the Calorie Target, 90–100% by default).

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 09 (Move personal tables to Members), 69 (Run the database tests locally)

**Status:** done

- [x] A Member can save, edit and clear each Target; carbs and fat can be left empty
- [x] Invalid values are refused with a message (band low above high, negative grams, etc.)
- [x] The screen shows the band as calories ("Aim: 1,800–2,000")
- [ ] Works for a Dependent through "logging for" (ticket 07) when that has landed

## Comments

- 2026-10-17: Built in worktree `t10` (branch `restart-t10`). Migration `supabase/migrations/010_member_targets.sql` adds nullable `protein_floor_g`, `carb_low_g`, `carb_high_g`, `fat_low_g`, `fat_high_g` to `member_settings` (non-negative; carb and fat ranges both empty or both filled with low at or below high). Calorie Target and band already exist in 007, so they are unchanged. Pure validation and data access in `web/src/lib/targets.js`; screen `web/src/components/TargetsPage.jsx` takes an optional `memberId` for ticket 07; wired into `App.jsx` with two lines. Locale keys under `targets` in en and es.
- 2026-10-17: Tests: `lib/targets.test.js` and `components/TargetsPage.test.jsx` use a mocked Supabase client. `npm run lint`, `npm test` (78 passed), `npm run build` and `npm run format:check` all pass in `web/`. NOT RUN: the migration (no SQL run, no Supabase CLI or Docker), so RLS and the new constraints are untested. The "logging for" box stays unticked until ticket 07 lands and a Dependent's Targets are checked through the screen.
