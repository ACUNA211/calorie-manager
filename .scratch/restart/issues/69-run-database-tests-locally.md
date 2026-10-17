# 69: Run the database tests locally

**Type:** your task (not for an agent)

**What to do:** Migrations 005–011 and their pgTAP tests were written without a database, because this machine had no Docker or Supabase CLI. Install Docker Desktop and the Supabase CLI. Then, in the repo root on the `restart` branch, run `supabase start`, `supabase db reset` (applies every migration) and `supabase test db`. If something fails, paste the error to Claude and it will fix the SQL. Never run these against the live project; this is the local stack only.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

**Unblocks:** 05, 06, 08, 09, 10, 12, 13

- [ ] Docker Desktop and the Supabase CLI are installed
- [ ] `supabase db reset` applies 001–011 with no errors
- [ ] `supabase test db` passes (households, shared tables, personal tables, AI usage, food macros, invites)
- [ ] Tick the database boxes on tickets 05, 06, 08, 09, 10, 12 and 13
