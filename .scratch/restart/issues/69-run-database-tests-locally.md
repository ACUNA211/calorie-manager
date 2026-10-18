# 69: Run the database tests locally

**Type:** your task (not for an agent)

**What to do:** Migrations 005–011 and their pgTAP tests were written without a database, because this machine had no Docker or Supabase CLI. Install Docker Desktop and the Supabase CLI. Then, in the repo root on the `restart` branch, run `supabase start`, `supabase db reset` (applies every migration) and `supabase test db`. If something fails, paste the error to Claude and it will fix the SQL. Never run these against the live project; this is the local stack only.

**Blocked by:** None (can start immediately)

**Status:** done

**Unblocks:** 05, 06, 08, 09, 10, 12, 13

- [x] Docker Desktop and the Supabase CLI are installed
- [x] `supabase db reset` applies 001–011 with no errors
- [x] `supabase test db` passes (households, shared tables, personal tables, food macros, invites; AI usage has no test file, see comment)
- [x] Tick the database boxes on tickets 05, 06, 08, 09, 10, 12 and 13

## Comments

2026-10-17: Run on Sergio's machine (Docker Desktop + `npx supabase`). `db reset` first failed: 001 extends `grocery_list`, which the live project had from before the repo, so `000_pre_existing_setup.sql` now creates it (plus the `http` extension and the Vault key slot), each a no-op on live. Then 5 of 21 test files failed; fixed and now **21 files, 379 tests pass**:
- Real bug, 017: `apply_food_spanish_name` left `calorie.name_es_source = 'translation'` set for the rest of the transaction, so a Member edit later in it never set `name_es_edited_by_member`. It now clears the setting after its write.
- Test bugs: `col_is_null` called with ('public.calorie_log', col, desc), which pgTAP reads as (schema, table, column) (client_id and macros tests); Bob had no Household in pantry_take; the recipe tags test inserted `set_calories` on `meal_times`, which moved to `meal_time_members` in 013, and counted tags after a copy had duplicated them.
Boxes left open on 06, 08, 09, 13 are ones these tests don't prove (sign-up screens, existing-data backfill, a run on a copy of the live project). Ticket 12 has no database test file yet.
