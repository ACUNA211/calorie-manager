# 22: Shared Meal Times

**What to build:** A Meal Time can be shared by several Members ("Family dinner 6:30"). When editing a Meal Time, pick which Members share it. Each sharing Member keeps their own calorie range for it. It shows on every sharing Member's Meal Times grid.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 21 (Meal Times page), 69 (Run the database tests locally), 72 (Decide: when do two Meal Times overlap?)

**Status:** done (awaiting DB test run)

- [x] Editing a Meal Time has a Members picker; the creator is always included
- [ ] A shared Meal Time shows on each sharing Member's grid, marked as shared
- [ ] Each sharing Member can have their own calorie range on it
- [ ] Removing a Member from a shared Meal Time leaves the others' unchanged

## Comments

- 2026-10-17: Built in worktree `t22` (branch `restart-t22`). Migration `supabase/migrations/013_shared_meal_times.sql` moves each Meal Time's calorie range to `meal_time_members` (one row per sharing Member, backfilled from the old columns), drops those columns from `meal_times`, and adds RLS so sharers see and edit a Meal Time while others see none. `save_meal_time()` writes the Meal Time and its sharers in one transaction; the creator and the editing Member are always sharers. `meal_times.member_id` is now the creator. `supabase/tests/personal_tables_members_test.sql` seeds were changed to the new shape. Vitest covers the picker, the shared marker, the RPC payload and the leave/delete rules (181 tests pass). Not run: the pgTAP tests (`shared_meal_times_test.sql`, and the updated 007 test) and the migration itself; those need ticket 69. The boxes for the grid and the range and removal rules wait on that run. Skills `plan-week-cal` and `rebalance-cal` still read `meal_times.cal_min`/`cal_max` and need updating before they run against the new schema.

- 2026-10-17 (dispatcher): migration 013 drops `meal_times.cal_min`, `cal_max` and `set_calories`. The old artifact skills `skills/plan-week-cal` and `skills/rebalance-cal` still read those columns; they need to join `meal_time_members` (or be retired in 68). The Meal Times page does not yet follow "logging for" (07): it should read `useActingMember().actingMemberId`.
