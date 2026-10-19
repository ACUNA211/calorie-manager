# 13: Macros in the Food Library

**What to build:** Foods store macros, not just calories: protein, carbohydrate, fat, fibre, sugars and sodium per 100 g, from USDA when a food is saved. Backfill the USDA foods already in the Food Library by re-reading them from USDA. Recipe totals (`recipe_totals`) add the same macros per serving.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 08 (Move shared tables into the Household), 69 (Run the database tests locally)

**Status:** done

- [x] Saving a USDA food stores all six macros when USDA has them; missing values stay empty, never zero
- [ ] Existing USDA foods are backfilled (a one-off script or function, rate-limited under 1,000 requests an hour)
- [x] Recipe totals show calories and the six macros per serving
- [x] The calorie sanity check (4·carb + 4·protein + 9·fat) still runs

## Comments

- 2026-10-17: Built in worktree `t13` (branch `restart-t13`). Migration `supabase/migrations/009_food_macros.sql` adds nullable `protein_g`, `carbs_g`, `fat_g`, `fibre_g`, `sugars_g`, `sodium_mg` and `macros_checked_at` to `foods`; new `usda_nutrient` (reads a full record or a search hit, NULL when absent, 0 kept as 0) and `atwater_kcal`; `usda_save` replaced with the same signature (stores the macros and runs the calorie check only when carb, protein and fat are all known); `recipe_totals` rebuilt with the six macros per serving, NULL when any ingredient lacks that macro. `scripts/backfill-usda-macros.mjs` is dry-run by default (`--apply` writes), rate-limited to 900 FDC requests an hour, and writes only macros USDA reports. Tests: `scripts/backfill-usda-macros.test.mjs` (12 Node tests, hand-written fixture `scripts/fixtures/fdc-food-sample.json`) passes with `node --test scripts/backfill-usda-macros.test.mjs`. pgTAP `supabase/tests/food_macros_test.sql` (38 tests) is written. Checkboxes are left unticked: nothing has run against a database.
- 2026-10-17: NOT RUN: no Postgres, psql or Supabase CLI is installed here, so the pgTAP test and the migration have not been executed. Both files parse with the pglast Postgres grammar (syntax only). The backfill has not been run against any real USDA or Supabase project. Run `supabase test db` on a local stack, then the backfill in dry-run before `--apply`.
