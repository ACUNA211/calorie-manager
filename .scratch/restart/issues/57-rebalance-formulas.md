# 57: Rebalance formulas

**What to build:** Pure, unit-tested functions for Rebalance (no AI): overage = logged + planned for the rest of the period − Calorie Target; then levers in order: drop If room Portions, shrink Planned Portions in quarter servings but never below their range, spread over the rest of the week at most 10% a day (a setting), else report it can't fit. Never touch Set Meal Times or logged meals; never change a Cook's servings made (shrunk servings become Leftovers). Return up to 3 options, smallest change first, each with where the day lands. The rules come from the old `rebalance-cal` skill.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 02 (App skeleton and sign-in)

**Status:** ready-for-agent

- [ ] Unit tests cover each lever, the 10% cap and the "can't fit" case
- [ ] No option ever touches a Set Meal Time or a logged meal (tested)
- [ ] No Planned Portion goes below its range (tested)
- [ ] Options are ordered smallest change first
