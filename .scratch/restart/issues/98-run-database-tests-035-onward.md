# 98: Run the database tests for migrations 035 onward

**Type:** your task (not for an agent)

**What to do:** Migrations 035 onward and their pgTAP tests were written without a database, like 005–011 were (ticket 69). On your machine, in the repo root on the `restart` branch, run `npx supabase start`, `npx supabase db reset` and `npx supabase test db`. New test files to watch: `label_photos_bucket_test.sql` (035, ticket 66), `plan_week_test.sql` (038, ticket 39), `preferences_test.sql` (037, ticket 37) `plan_edit_test.sql` (039, ticket 40) `hard_rule_filter_test.sql` (040, ticket 38; watch for regex errors), `member_intake_test.sql` (042, ticket 64), `push_subscriptions_test.sql` (043, ticket 54), `plan_validation_data_test.sql` (045, ticket 41), `shopping_list_test.sql` (044, ticket 46) and `approve_test.sql` (041, ticket 45; also check `plan_edit_test.sql` and the shopping list tests still pass after it). 036 (ticket 67) has no test file. If anything fails, paste the error to Claude. Then, with `npm run dev` in `web/` against the local stack, open More → Plan, add a Cook, place, move, resize and remove Portions, delete a Cook, and edit an approved plan (ticket 40's boxes 1, 3 and 4; ticket 39's box 1), and check the validator's warnings show on cells and under the day totals (ticket 41). Then with two accounts: as the Owner, tick and untick a Member under Household → who may approve; as that Member, Approve shows on Plan only when allowed, approving twice adds nothing, and editing an approved plan shows "Approve the changes", which clears the notice (ticket 45); approving also fills More → Shopping list with only what the Pantry doesn't cover, grouped by store section (ticket 46). Finally open More → Intake form in English and Spanish, with metric and US units, and check the suggested Targets look sensible for you; the exercise thresholds (one activity level up from 90 min a week, two from 300) were the agent's choice, not the research's, so say in ticket 64 if you want them changed. Local stack only; pushing to the live project is ticket 79's kind of review step, not this one.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

**Unblocks:** 37, 38, 39, 40, 41, 45, 46, 54, 64, 66, 102

- [ ] `db reset` applies every migration with no errors
- [ ] `supabase test db` passes, including the new files
- [ ] Tick the database boxes on tickets 37, 38, 39, 40, 45, 64 and 66
