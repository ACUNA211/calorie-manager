# 08: Move shared tables into the Household

**What to build:** The existing shared tables become Household-owned: Food Library foods, Recipes and their ingredients, Meal Plans, Cooks, and the Shopping list (`grocery_list`). Add `household_id` with policies using the helper from ticket 05. Move the current rows into the Owner's Household (the person who owns the existing project data). Keep the existing functions working.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 05 (Households and Members), 69 (Run the database tests locally)

**Status:** done (awaiting review)

- [x] Each shared table has a non-null `household_id` and Household policies
- [ ] Every existing row belongs to the Owner's Household after the migration
- [ ] Existing functions (USDA search/save, shopping list sync, approve) still pass a smoke test
- [x] A test proves a second Household can't see these rows
- [ ] The migration can run on a copy of the current project without errors

## Comments

- 2026-10-17: Built in worktree `restart-t08` (branch `restart-t08`). Migration `supabase/migrations/006_shared_tables_to_household.sql` adds `household_id` (NOT NULL, FK to `households`, cascade, index, default `private.current_household_id()`) to `foods`, `recipes`, `recipe_ingredients`, `meal_plans`, `cooks` and `grocery_list`, with select/insert/update/delete policies for `authenticated` using `household_id in (select private.my_household_ids())`. Backfill owner: the earliest-created `auth.users` row, since none of these tables has a user column. That person's existing Household is used, otherwise one is created with them as Owner. With shared rows but no login, an unowned Household is created. With no shared rows, nothing is created. Uniqueness is now per Household: the USDA index on `foods` is `(household_id, source, source_id)`, and `meal_plans` has `unique (household_id, week_start)`. Functions: `sync_shopping_list` replaced (takes the Household from the plan and writes it to new lines); `usda_save` and `usda_lookup_gtin` replaced (SECURITY DEFINER, filter by the caller's Household). `approve_meal_plan`, `cooks_sync_trigger` and `shopping_measure` are unchanged (SECURITY INVOKER, scoped by RLS). `usda_search` and `usda_get` are unchanged. New helper `private.current_household_id()`.
- 2026-10-17: pgTAP test `supabase/tests/shared_tables_household_test.sql` (22 tests) gives Alice and Bob each a Household and one row per shared table, then proves neither can see, update or delete the other's rows. NOT RUN: the Supabase CLI, Docker and psql are not installed here, so the SQL has not been executed. The boxes stay unticked until `supabase db reset` and `supabase test db` pass locally. Open risk: `grocery_list` is not defined in the repo, so the migration assumes the existing table; any pre-existing policies on it would still apply.
