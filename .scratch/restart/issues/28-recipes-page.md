# 28: Recipes page

**What to build:** Port the Recipes list and Recipe editor: name, ingredients from the Food Library with amounts in grams, "makes N servings" or a weighed cooked yield, and a notes field. Calories and macros per serving come from the ingredients (Recipe totals). The library belongs to the Household.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 13 (Macros in the Food Library), 08 (Move shared tables into the Household)

**Status:** ready-for-agent

- [ ] A Member can add, edit and delete a Recipe and its ingredients
- [ ] Per-serving calories and macros update as ingredients change
- [ ] A cooked weight, when given, sets the serving size in grams
- [ ] Every Member of the Household sees the same Recipes
