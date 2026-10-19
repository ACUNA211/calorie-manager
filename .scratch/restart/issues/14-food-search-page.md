# 14: Food search page

**What to build:** A Foods screen: type to search the Food Library first and USDA second (using the existing USDA search function), see calories and macros per 100 g and per serving, and save a USDA result into the Food Library. Search ignores accents and case (port the old `norm` helper).

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 13 (Macros in the Food Library), 04 (English/Spanish switch), 81 (Decide: show macros on USDA search results?), 86 (Set a real USDA API key)

**Status:** done

- [x] Results show Food Library matches first, then USDA
- [ ] Each result shows calories and macros per serving and per 100 g, in the Member's units
- [ ] Saving a USDA result adds it once (no duplicates on a second save)
- [x] Works in English and Spanish screens

## Comments

- 2026-10-17: Built in worktree `t14` (branch `restart-t14`). New `web/src/components/FoodsPage.jsx` (search box, results with per-100 g and per-serving tables, Save for USDA results), `web/src/lib/foods.js` (library ranking, USDA merge with saved-food dedupe, per-serving maths, `searchFoods`, `saveUsdaFood`), `web/src/lib/norm.js` (the old `norm` port plus plural-folding tokens), locale key `foods` in en.json and es.json, and two lines in `App.jsx`. No migration: uses the existing `usda_search` and `usda_save` functions and `foods` RLS. Tests (mocked Supabase, no database): `norm.test.js`, `foods.test.js`, `FoodsPage.test.jsx` (English and Spanish). Not done: macros for a USDA result appear only after saving, because `usda_search` returns calories only (a later migration could add them to `usda_hit`); per-100 g and per-serving show grams, not the Member display units (ticket 11 not built); library search reads at most 2000 Food Library rows per search. Not verified: the no-duplicate save against a real database (`usda_save` returns the existing row; not run), and the screen on a phone.
- 2026-10-17: Fix in `supabase/migrations/024_usda_app_grants.sql` (branch `restart-tusda`): migration 003 revoked execute on `usda_search` and `usda_save` from `authenticated`, and 006 and 009 kept that revoke, so the signed-in Foods, Today, Pantry and Recipes calls to them would fail with permission denied. 024 grants both to `authenticated` only. Checked: `usda_save` takes the Household from `private.current_household_id()` and fails for a signed-in user with no Household; `usda_search` reads no Household data. `usda_get` (holds the USDA key) stays revoked, and anon keeps no access. Test: `supabase/tests/usda_app_grants_test.sql` (grant checks only). Not run: the pgTAP test (needs a local stack, ticket 69); no database was touched.
