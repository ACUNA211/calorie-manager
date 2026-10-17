# 47: Bought / Have it

**What to build:** Each Shopping list line has two ticks: **Bought** adds its amount to the Pantry, **Have it** corrects the Pantry to say the needed amount is there. Ticked lines move to a done section and are never unticked.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 46 (Shopping list from approve)

**Status:** ready-for-agent

- [ ] Bought adds the line's grams to the Pantry
- [ ] Have it sets the Pantry to at least the needed amount
- [ ] Ticked lines move to done; Undo is available for a few seconds
