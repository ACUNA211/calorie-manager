# 57: Rebalance formulas

**What to build:** Pure, unit-tested functions for Rebalance (no AI): overage = logged + planned for the rest of the period − Calorie Target; then levers in order: drop If room Portions, shrink Planned Portions in quarter servings but never below their range, spread over the rest of the week at most 10% a day (a setting), else report it can't fit. Never touch Set Meal Times or logged meals; never change a Cook's servings made (shrunk servings become Leftovers). Return up to 3 options, smallest change first, each with where the day lands. The rules come from the old `rebalance-cal` skill.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 02 (App skeleton and sign-in)

**Status:** done (awaiting review)

- [x] Unit tests cover each lever, the 10% cap and the "can't fit" case
- [x] No option ever touches a Set Meal Time or a logged meal (tested)
- [x] No Planned Portion goes below its range (tested)
- [x] Options are ordered smallest change first

## Comments

- 2026-10-18: Built `web/src/lib/rebalanceLogic.js` (+ tests, 14). Rules interpreted: (1) "Within range" is checked per Meal Time: its unlogged Planned Portions together never fall below `calMin`. (2) Options are lever sets drop / shrink / drop+shrink / spread; only those that get the day under the Calorie Target are returned (max 3, least calories removed first). (3) "Spread" means: if today's levers cannot cover the overage, each later day gives at most `maxSpreadPct` (default 10) of the Calorie Target via the same two levers, so today itself can still land over while the week absorbs it. (4) Quarter-step shrink can overshoot the need by under a quarter serving. (5) Dropped/shrunk servings are reported as `leftoverServings`; servings made is never output. Not wired to UI or Jev yet.
