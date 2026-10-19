# 46: Shopping list from approve

**What to build:** Adapt the existing shopping list functions: approving a Meal Plan adds a line per food for what the plan needs minus what the Pantry holds, in one shopping measure (the unit stores sell in), ordered by store section. Each line shows the date it was added. Port the Shopping list screen.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 45 (Approve), 25 (Pantry page)

**Status:** done (awaiting you to run `supabase db reset` then `supabase test db` on a local stack, which checks migration 044 and shopping_list_test.sql, then tick the three database boxes)

- [ ] Approving adds lines only for foods the Pantry doesn't fully cover (tested with sample Pantry amounts)
- [x] Lines group by store section and show their date
- [ ] Changing the plan after approval adds a new line for any extra need; existing lines aren't rewritten
- [ ] Every Member sees the same list

## Comments

- 2026-10-19: From ticket 45: `plan_approve()` (migration 041) ends by calling the existing `sync_shopping_list(plan_id)`, marked "HOOK (46)", only when a plan is newly approved or was edited since approval. Replace or keep that one call here.

- 2026-10-19: Done on branch restart-t46. Migration 044 rewrites `sync_shopping_list` (kept as the single call from `plan_approve()` and the cooks trigger): need minus Pantry in one shopping measure (package weight, else largest serving, else 50 g steps), lines added in store-section order, each with `created_at` as its added date; extra need after approval adds `plan_extra` lines and never rewrites old ones, tracked in the new `shopping_cover` table. New `/shopping` screen (`ShoppingPage`, `lib/shopping.js`, `lib/shoppingLogic.js`) with links from Plan and Pantry. Web lint, build, format and 1122 Vitest tests pass; the screen box is ticked from component tests. The three database boxes are NOT ticked: `supabase/tests/shopping_list_test.sql` (20 checks) was written but not run, as no local Supabase stack was available.
