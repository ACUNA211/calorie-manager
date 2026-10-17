# 08: Move shared tables into the Household

**What to build:** The existing shared tables become Household-owned: Food Library foods, Recipes and their ingredients, Meal Plans, Cooks, and the Shopping list (`grocery_list`). Add `household_id` with policies using the helper from ticket 05. Move the current rows into the Owner's Household (the person who owns the existing project data). Keep the existing functions working.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 05 (Households and Members)

**Status:** ready-for-agent

- [ ] Each shared table has a non-null `household_id` and Household policies
- [ ] Every existing row belongs to the Owner's Household after the migration
- [ ] Existing functions (USDA search/save, shopping list sync, approve) still pass a smoke test
- [ ] A test proves a second Household can't see these rows
- [ ] The migration can run on a copy of the current project without errors
