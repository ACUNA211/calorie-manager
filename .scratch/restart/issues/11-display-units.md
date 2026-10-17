# 11: Display units

**What to build:** Each Member chooses metric or US display units. Everything stays stored in grams; one shared formatter turns grams into the chosen units (g/kg or oz/lb, ml/l or fl oz/cups for liquids where the food says so). Every screen that shows an amount uses this formatter.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 05 (Households and Members)

**Status:** ready-for-agent

- [ ] A units setting on the Member, defaulting to US
- [ ] One formatter function with unit tests for grams → oz/lb and back
- [ ] Typing an amount in US units stores the right number of grams (tested)
- [ ] No screen formats amounts on its own (search for raw "g" labels)

- 2026-10-17 (dispatcher): screens to convert now include Foods (14: per-100 g and per-serving tables), Recipes (28: ingredient grams, totals) and Meal Times.
