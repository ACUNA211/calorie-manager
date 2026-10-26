# 29: Recipe star, tags and copy

**What to build:** On a Recipe: star it, tag the Meal Times it suits (a hint for planning, not a rule), and copy it as a variation that names its original but never changes with it.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 28 (Recipes page), 69 (Run the database tests locally), 80 (Decide: Recipe servings, save and delete rules)

**Status:** done

- [x] Star and Meal Time tags save and show in the Recipes list (with a starred filter)
- [x] Copy makes a new Recipe with the same ingredients and a link back to the original
- [x] Editing the copy never changes the original, and the reverse

**Comments:**

- 2026-10-17: Added migration `016_recipe_star_tags_copy.sql` and its test `recipe_star_tags_copy_test.sql`. Tags move to a join table `recipe_meal_time_tags` (RLS per Household, and a trigger that refuses a Meal Time from another Household); the old `recipes.meal_time_tags` array is left unused. `recipe_copy(id, name)` copies the Recipe, its ingredients and tags in one call; the original link is `copied_from`, cleared (not the copy) when the original is deleted. Web: tag checkboxes and a starred-only filter in `RecipesPage`/`RecipeEditor`, a "Copy as a variation" action, and `loadMealTimeOptions`, `copyRecipe` in `lib/recipes.js`. Verified only with Vitest and fake clients: web suite 248 passed, lint, build and format:check pass. The pgTAP test has NOT been run (no local database here), so the copy and tag-trigger boxes stay unticked. Decisions to confirm: a tag on another Member's Meal Time shows as "a Meal Time you cannot see" and is kept on save; the tag picker lists every Meal Time the caller can read (including Dependents'); the copy is never starred and takes the saved version, not unsaved edits.
- 2026-10-18: `supabase db reset` (001–033) and `supabase test db` run on the local stack: 22 files, 387 tests, all pass.
- 2026-10-25: Ticket 80 decisions. (4) Old tag column: drop `recipes.meal_time_tags` in a later migration (ticket 106). (5) Tags on a Meal Time you cannot see: keep them as they are, shown as "a Meal Time you cannot see" and kept on save. (6) Deleted original: keep it as it is. The copy stays and loses its "Variation of" link.
