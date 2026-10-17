# 62: Voice: logging

**What to build:** Voice commands to log: "I ate lunch" logs the planned Portion; "I had an apple" logs something else from the Food Library or Pantry. Same option-card flow as ticket 61.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 61 (Voice: Shopping list), 51 (Log Portions and Leftovers)

**Status:** ready-for-agent

- [ ] "I ate lunch" offers the planned Portion at the current Meal Time
- [ ] "I had an apple" offers matching foods with an amount
- [ ] Logging takes from the Cook or Pantry as in tickets 27 and 51
