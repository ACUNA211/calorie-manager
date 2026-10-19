# 45: Approve

**What to build:** The Owner, or Members the Owner allows, approve a draft Meal Plan. Approving marks it approved and is the trigger for the Shopping list (ticket 46).

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 40 (Plan grid editing)

**Status:** done (awaiting you: run the database tests with `supabase test db`, push migration 041, then try allow/disallow on the Household page and Approve on /plan with two real accounts)

- [ ] Only the Owner or allowed Members see Approve (policy enforced)
- [ ] The Owner can allow or disallow Members on the Household page
- [ ] Approving twice does nothing extra

## Comments

- 2026-10-19: From ticket 40: migration 039 adds `meal_plans.changed_since_approval`, cleared by a trigger only when the status changes. Re-approving an already-approved plan must clear it too.
- 2026-10-19: Built (ticket 45). Migration 041 adds `members.can_approve`, `plan_can_approve()`, `set_member_can_approve()` (Owner only) and `plan_approve(plan_id)`; it shuts the old ungated `approve_meal_plan`. Approving twice changes nothing; re-approving an edited plan clears `changed_since_approval`. Plan page shows Approve ("Approve the changes" after edits) only to those allowed; the Household page has the Owner's checkbox list (`ApproverSetting`). Boxes left unticked because the policy checks live in `supabase/tests/approve_test.sql` (18 assertions), which was not run (no local Supabase); the screens are covered by component tests with mocked calls only. Hook for ticket 46: `plan_approve()` ends by calling the existing `sync_shopping_list(plan_id)` (marked "HOOK (46)" in the migration), only when the plan was newly approved or had been changed.
