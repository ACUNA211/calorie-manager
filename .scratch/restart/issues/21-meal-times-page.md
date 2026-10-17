# 21: Meal Times page

**What to build:** Port the Meal Times week grid from the old app (rows are Meal Times, columns are weekdays; tap a cell to toggle a day, tap a name to edit) for the current Member. Kinds are Set (one number), Planned and If room (calorie ranges), as in `CONTEXT.md`. Day totals show under each column against the Calorie Target and band.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 09 (Move personal tables to Members)

**Status:** ready-for-agent

- [ ] A Member can add, edit and delete Meal Times and toggle weekdays
- [ ] Set needs one calorie number; Planned and If room need a range
- [ ] Day totals show under each weekday against the Target and band
- [ ] Overlapping times on the same day ask whether the new one replaces the other
