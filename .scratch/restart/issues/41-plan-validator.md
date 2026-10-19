# 41: Plan validator

**What to build:** A tested function that checks a Meal Plan, slot by slot: every Planned Meal Time is filled inside its range, each Member's day lands in their Planning band, no Hard rule is broken for anyone eating, every Recipe id exists, Set Meal Times are left alone. It returns a list of failing slots with reasons.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 38 (Hard-rule filter), 40 (Plan grid editing)

**Status:** done (awaiting you: run the database tests with `supabase test db` and push migration 045, then open /plan with real data to see the warnings)

- [x] Returns no failures for a valid plan and the right failures for each kind of break (unit tests)
- [x] Runs in well under a second for a full Household week
- [x] The Plan grid shows the failures as warnings on their slots

## Comments

- 2026-10-19: Built. `web/src/lib/planValidator.js` is pure JS with no imports (comment says a Deno Edge Function in 42/43 can import it). `validatePlan(data)` returns `{ ok, failures }`; each failure is `{ code, day, memberId, mealTimeId, cookId, portionId, params }` with codes `unfilled`, `belowRange`, `aboveRange`, `setTouched`, `hardRule`, `unknownRecipe`, `dayUnder`, `dayOver` (text under `plan.validation.*` in en and es). Choices to check: Planned is checked at both ends of the Member's own range, If room only against its maximum; a Portion at a Set Meal Time is a failure; the Set calories count toward the day against the band (the grid's own day total row does not add them, so the warning figure can differ from it); a day on which a Member has no Meal Time and no Portion is not band-checked; a Member without a band is skipped. The grid data (038) lacks each sharer's range and the Hard-rule breaks, so migration 045 adds `plan_validation_data(week_start)` (ranges, breaks from `private.hard_rule_breaks_core` for this plan's Recipes and eating Members, existing Recipe ids); `supabase/tests/plan_validation_data_test.sql` (6 assertions) written, NOT run (no local stack). The Plan page shows warnings in the cell, under the Member's day total, and a count line; if the check cannot load the grid still shows. Measured in Vitest (4 Members x 7 days x 5 Meal Times, 112 Portions, 168 failures): first run 0.27 ms, average 0.185 ms over 200 runs. Checked: lint, build, format:check, 1164 tests pass (full parallelism, 87 files). The warnings were tested with a mocked client only, not against a real database or in the browser.
