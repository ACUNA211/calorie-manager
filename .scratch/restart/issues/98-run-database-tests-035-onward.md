# 98: Run the database tests for migrations 035 onward

**Type:** your task (not for an agent)

**What to do:** Migrations 035 onward and their pgTAP tests were written without a database, like 005–011 were (ticket 69). On your machine, in the repo root on the `restart` branch, run `npx supabase start`, `npx supabase db reset` and `npx supabase test db`. New test files to watch: `label_photos_bucket_test.sql` (035, ticket 66), `plan_week_test.sql` (038, ticket 39), and the Preferences test (037, ticket 37). 036 (ticket 67) has no test file. If anything fails, paste the error to Claude. Local stack only; pushing to the live project is ticket 79's kind of review step, not this one.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

**Unblocks:** 37, 39, 66

- [ ] `db reset` applies every migration with no errors
- [ ] `supabase test db` passes, including the new files
- [ ] Tick the database boxes on tickets 37, 39 and 66
