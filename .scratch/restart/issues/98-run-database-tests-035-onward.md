# 98: Run the database tests for migrations 035 onward

**Type:** your task (not for an agent)

**What to do:** Migrations 035 onward and their pgTAP tests were written without a database, like 005–011 were (ticket 69). On your machine, in the repo root on the `restart` branch, run `npx supabase start`, `npx supabase db reset` and `npx supabase test db`. New test files to watch: `label_photos_bucket_test.sql` (035, ticket 66), `plan_week_test.sql` (038, ticket 39), `preferences_test.sql` (037, ticket 37) and `plan_edit_test.sql` (039, ticket 40). 036 (ticket 67) has no test file. If anything fails, paste the error to Claude. Then, with `npm run dev` in `web/` against the local stack, open More → Plan, add a Cook, place, move, resize and remove Portions, delete a Cook, and edit an approved plan (ticket 40's boxes 1, 3 and 4; ticket 39's box 1). Local stack only; pushing to the live project is ticket 79's kind of review step, not this one.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

**Unblocks:** 37, 39, 40, 66

- [ ] `db reset` applies every migration with no errors
- [ ] `supabase test db` passes, including the new files
- [ ] Tick the database boxes on tickets 37, 39, 40 and 66
