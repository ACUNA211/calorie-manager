# 09: Move personal tables to Members

**What to build:** The existing personal tables become per Member: Meal Times, Portions, the Calorie Log, and the one-row settings (which becomes a per-Member settings row). Add `member_id` (and the Household through the Member) with policies. Portions' unique key becomes (member, Meal Time, date). Move current rows to the Owner's Member.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 05 (Households and Members)

**Status:** done (awaiting DB test run)

- [ ] Meal Times, Portions and Calorie Log rows each have a Member; current rows belong to the Owner
- [ ] The one-row settings table is replaced by one settings row per Member, with the current Calorie Target and Planning band kept
- [ ] Portions are unique per (member, Meal Time, date)
- [ ] Policies let adults see their own rows and their Dependents' rows (tested); other Members' visibility is ticket 33

## Comments

- 2026-10-17: Built in worktree `t09` (branch `restart-t09`). Migration `supabase/migrations/007_personal_tables_to_members.sql` adds `member_id` to `meal_times`, `portions` and `calorie_log`, and replaces `member_settings` with one row per Member (`member_id` unique; the Owner's row keeps the old Calorie Target and band). Backfill rule: if no Household exists and exactly one auth user exists, that user becomes the Owner of a new Household; existing rows go to the single Owner's Member; if rows exist without exactly one Owner the migration raises and rolls back; with no rows and no user it is a no-op. With no Owner, the legacy settings row is kept as `member_settings_legacy`. Portions' unique key is now (member_id, meal_time_id, eat_date). A trigger gives each new Member a default settings row. Helper `private.my_member_ids()` (SECURITY DEFINER, same style as 005) gives the caller's own Member plus the Dependents of their Households; RLS policies on the four tables use it. Functions replaced: none, since no function in 001-004 reads these tables or the settings row.
- 2026-10-17: pgTAP test `supabase/tests/personal_tables_members_test.sql` (31 tests) covers Household isolation, Dependent access, settings, NOT NULL and the Portions key. NOT RUN: the Supabase CLI, Docker and psql are not installed, so the SQL has not been executed. The boxes above stay unticked until `supabase db reset` and `supabase test db` pass locally. Risk: the test seeds `meal_plans`, `recipes` and `cooks`; if 006 makes `household_id` NOT NULL on them, those inserts need it.
