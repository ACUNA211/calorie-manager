# 106: Recipe save in one call, delete detaches Cooks, drop the old tag column

**What to build:** Three changes decided in ticket 80 (2026-10-25), one migration.

1. **Atomic save.** Today `lib/recipes.js` saves the Recipe row and then its ingredient rows in two calls, so a failure in between leaves a Recipe with missing or stale ingredients. Move the save into one database function (Recipe row, its ingredient rows and its Meal Time tags in one transaction, `security invoker` so RLS still applies) and call it from `saveRecipe`. Tags on Meal Times the caller cannot see are kept, as now (ticket 29's rule).
2. **Deleting a Recipe a Cook uses detaches the Cook.** `cooks.recipe_id` is `not null references recipes(id)` with no `on delete`, so the delete fails today. Make it nullable with `on delete set null`. A Cook currently gets its name and kcal per serving from its Recipe, so before the link goes, the Cook must keep what it needs to still show and count: add snapshot columns (e.g. `recipe_name`, kcal and macros per serving) filled when the Cook is made or when its Recipe is deleted, and read them where the Recipe is gone. Check every reader of `cooks.recipe_id`: `plan_week_read` (038), plan grid editing (039), plan validation (045), the shopping-list trigger (002), Today and logged Portions. A Portion already logged must keep its calories.
3. **Drop `recipes.meal_time_tags`.** Tags live in `recipe_meal_time_tags` since migration 016; the old array column is unused. Drop it and remove any leftover reads.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Saving a Recipe is one call; a failing ingredient row leaves the Recipe as it was (pgTAP test)
- [ ] Deleting a Recipe that a Cook uses succeeds; the Cook keeps its name and calories on the Plan, Today and Shopping list (pgTAP test)
- [ ] `recipes.meal_time_tags` is gone and nothing reads it
- [ ] `supabase test db` and the web suite pass

## Comments

- 2026-10-25: Written from the ticket 80 decisions. Belongs to Release 1 (follows 28 and 29).
