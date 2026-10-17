# 28: Recipes page

**What to build:** Port the Recipes list and Recipe editor: name, ingredients from the Food Library with amounts in grams, "makes N servings" or a weighed cooked yield, and a notes field. Calories and macros per serving come from the ingredients (Recipe totals). The library belongs to the Household.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 13 (Macros in the Food Library), 08 (Move shared tables into the Household)

**Status:** done (awaiting review)

- [x] A Member can add, edit and delete a Recipe and its ingredients
- [x] Per-serving calories and macros update as ingredients change
- [x] A cooked weight, when given, sets the serving size in grams
- [ ] Every Member of the Household sees the same Recipes

**Comments:**

- 2026-10-17: Built `RecipesPage.jsx`, `RecipeEditor.jsx`, `RecipeIngredientsField.jsx`, `RecipeTotals.jsx`, `lib/recipes.js` and `lib/recipeTotals.js`, plus the `recipes` locale keys and two lines in `App.jsx`. No migration: 006 (Household tables and RLS) and 009 (recipe macros) already cover it. Verified only with Vitest and fake Supabase clients: web test suite 228 passed (62 new), lint, build and format:check pass. Not verified against a live Supabase, so Household sharing (the last box) is unticked. Decisions: servings still divide the totals, and a cooked weight sets grams per serving. Food search matches the English name only (foods has no Spanish name column). Save writes the Recipe and then its ingredient lines in two steps. Deleting a Recipe that a Cook uses fails, because cooks reference recipes.
