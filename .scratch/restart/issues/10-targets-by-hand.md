# 10: Targets by hand

**What to build:** A Targets screen per Member to type in their Targets from `CONTEXT.md`: Calorie Target (a ceiling), protein floor (grams), optional carb and fat ranges (grams), and the Planning band (percent of the Calorie Target, 90–100% by default).

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 09 (Move personal tables to Members)

**Status:** ready-for-agent

- [ ] A Member can save, edit and clear each Target; carbs and fat can be left empty
- [ ] Invalid values are refused with a message (band low above high, negative grams, etc.)
- [ ] The screen shows the band as calories ("Aim: 1,800–2,000")
- [ ] Works for a Dependent through "logging for" (ticket 07) when that has landed
