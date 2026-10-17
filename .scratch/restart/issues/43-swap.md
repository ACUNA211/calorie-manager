# 43: Swap

**What to build:** On a Cook in the draft, "Swap" asks the model for 3 other Recipes that fit the same slots (same candidate rules as ticket 42). The Member picks one, or none.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 42 (AI draft)

**Status:** ready-for-agent

- [ ] Swap shows 3 alternatives that pass the Hard-rule filter
- [ ] Picking one replaces the Cook and re-sizes its Portions; the validator re-runs
- [ ] Nothing changes if the Member closes the sheet
