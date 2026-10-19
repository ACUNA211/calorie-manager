# 45: Approve

**What to build:** The Owner, or Members the Owner allows, approve a draft Meal Plan. Approving marks it approved and is the trigger for the Shopping list (ticket 46).

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 40 (Plan grid editing)

**Status:** ready-for-agent

- [ ] Only the Owner or allowed Members see Approve (policy enforced)
- [ ] The Owner can allow or disallow Members on the Household page
- [ ] Approving twice does nothing extra

## Comments

- 2026-10-19: From ticket 40: migration 039 adds `meal_plans.changed_since_approval`, cleared by a trigger only when the status changes. Re-approving an already-approved plan must clear it too.
