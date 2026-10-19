# 93: Macros always in grams

**What to fix:** With US display units, protein, carbs and fat show in ounces ("Protein 0 oz"). Macros are counted in grams everywhere, including on US labels, so they should always show in grams; only food amounts follow the Member's units. Found in the ticket 79 review on the local stack, 2026-10-18.

Cause: macro amounts go through `formatMass` from `useUnits()` (`lib/units.js`), which converts to oz and lb for US. Seen in `DayBar.jsx`'s `MacroLine`. Check the other components that use `formatMass` and show macros: `EditEntryPanel`, `FoodsPage`, `LogFoodPanel`, `RecipeTotals`, `TodayPage`, `WeekPage`, and the Targets page's protein floor and carb and fat ranges. Add a grams-only formatter for macros (sodium stays in mg) and keep `formatMass` for food amounts.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] With US units, every macro shows in g (sodium in mg); food amounts still show in oz and lb
- [ ] Targets are entered and shown in g whatever the units
- [ ] Tests cover a macro and a food amount under US units

## Comments

- 2026-10-18: Written during the ticket 79 review. Belongs to Release 1.
