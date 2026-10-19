# 40: Plan grid editing

**What to build:** On the Plan grid, add a Cook (pick a Recipe and a cook day), place its Portions at Meal Times, move or remove them, and delete a Cook. At a shared Meal Time, code sizes each Member's Portion to what they have left in their band (in quarter servings), not the AI.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 39 (Plan grid (view))

**Status:** done (awaiting you: run the database tests with `supabase test db`, push migration 039, then try add, place, move, remove and delete on /plan with real data)

- [ ] Add, move and remove Cooks and Portions; changes save straight away
- [x] Portions at shared Meal Times are sized by a tested function from each Member's remaining calories
- [ ] A Cook's servings made covers all its Portions (it grows when needed)
- [ ] Editing an approved plan is allowed and is marked as changed since approval

## Comments

- 2026-10-19: Built. Migration 039 adds `meal_plans.changed_since_approval` (cleared by trigger when status changes), `plan_meal_times()` (every Household Meal Time, for empty slots), re-creates `plan_week` with the flag, and security-definer writes `plan_add_cook`, `plan_delete_cook`, `plan_set_portion` (upsert, grows servings made, Member must share the Meal Time), `plan_move_portion`, `plan_remove_portion`; logged Portions cannot be moved/removed. These let a Member place Portions for others at shared Meal Times without widening RLS. Sizing is `sizePortion`/`planPlacement` in planLogic.js: band top minus the day's planned kcal, divided by empty Planned slots, rounded down to quarters, min 0.25, max 4; no band gives 1. Servings made starts at the Recipe's servings and only grows. Boxes 1, 3, 4 left unticked: only unit and component tests (mocked client) ran; pgTAP `supabase/tests/plan_edit_test.sql` never run (no local stack). Ticket 45 should clear `changed_since_approval` when re-approving. Checked: lint, build, format:check, 1047 tests pass (full parallelism).
