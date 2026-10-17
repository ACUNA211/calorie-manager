# 13: Macros in the Food Library

**What to build:** Foods store macros, not just calories: protein, carbohydrate, fat, fibre, sugars and sodium per 100 g, from USDA when a food is saved. Backfill the USDA foods already in the Food Library by re-reading them from USDA. Recipe totals (`recipe_totals`) add the same macros per serving.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 08 (Move shared tables into the Household)

**Status:** ready-for-agent

- [ ] Saving a USDA food stores all six macros when USDA has them; missing values stay empty, never zero
- [ ] Existing USDA foods are backfilled (a one-off script or function, rate-limited under 1,000 requests an hour)
- [ ] Recipe totals show calories and the six macros per serving
- [ ] The calorie sanity check (4·carb + 4·protein + 9·fat) still runs
