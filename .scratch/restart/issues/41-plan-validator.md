# 41: Plan validator

**What to build:** A tested function that checks a Meal Plan, slot by slot: every Planned Meal Time is filled inside its range, each Member's day lands in their Planning band, no Hard rule is broken for anyone eating, every Recipe id exists, Set Meal Times are left alone. It returns a list of failing slots with reasons.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 38 (Hard-rule filter), 40 (Plan grid editing)

**Status:** ready-for-agent

- [ ] Returns no failures for a valid plan and the right failures for each kind of break (unit tests)
- [ ] Runs in well under a second for a full Household week
- [ ] The Plan grid shows the failures as warnings on their slots
