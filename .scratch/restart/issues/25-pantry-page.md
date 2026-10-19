# 25: Pantry page

**What to build:** The Household's Pantry from `CONTEXT.md`: a list of foods at home with exact amounts (grams or units). Add an item by searching a food and entering an amount. Correct an item as "used up", "about half" or a typed amount. Sorted by store section.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 14 (Food search page), 08 (Move shared tables into the Household), 69 (Run the database tests locally)

**Status:** done

- [x] Every Member of the Household sees and edits the same Pantry
- [x] Adding the same food twice adds to its amount instead of a second row
- [x] "Used up" sets it to zero and hides it; "about half" halves it
- [ ] Amounts show in the Member's units

## Comments

- 2026-10-17: Built in worktree `t25` (branch `restart-t25`). Migration `supabase/migrations/019_pantry.sql`: table `pantry_items` (one row per food per Household, unique on household and food, grams in numeric(10,1)), RLS select for the Household, and two functions: `pantry_add` (adds to an existing row or creates one) and `pantry_correct` ("used_up", "half", "set", under a row lock). pgTAP test `supabase/tests/pantry_test.sql` (25 assertions; includes a second Member of Alice's Household). Web: `web/src/components/PantryPage.jsx`, `PantryAddForm.jsx`, `PantryList.jsx`; `web/src/lib/pantry.js` (data access, reuses `searchFoods` and `saveUsdaFood` from foods.js) and `web/src/lib/pantryLogic.js` (amount rules, corrections, store-section grouping); locale key `pantry` in en.json and es.json; `App.jsx` gets the import and `<PantryPage user={session.user} />` as the last page. Tests (Vitest, fake Supabase, no database): `pantryLogic.test.js`, `pantry.test.js`, `PantryPage.test.jsx`. Amounts show in grams only; units wait for ticket 11. Not verified: the SQL and RLS (the pgTAP test has not been run; ticket 69), so the sharing and "adds to the same row" behaviour is untested against a database; the pgTAP `throws_ok` calls pass a null message, which pgTAP should accept but is unconfirmed. No checkboxes ticked: the Vitest tests run the screen against a fake backend only.
- 2026-10-18: `supabase db reset` (001–033) and `supabase test db` run on the local stack: 22 files, 387 tests, all pass.
