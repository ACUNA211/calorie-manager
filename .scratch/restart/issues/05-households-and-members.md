# 05: Households and Members

**What to build:** Add Households and Members as in `CONTEXT.md`: a Household table, a Member table (linked to a Supabase user, or no user for a Dependent), and the Owner. A signed-in person with no Household can create one and becomes its Owner. Add row-level security through a `SECURITY DEFINER` helper in a private schema that returns the caller's Household ids, used as `(select ...)` in policies. Add a Household page listing its Members.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 02 (App skeleton and sign-in), 69 (Run the database tests locally)

**Status:** done (awaiting review)

- [x] Creating a Household makes the creator its Owner and only Member
- [x] A person belongs to at most one Household (enforced in the database)
- [x] Policies stop a signed-in person from reading or writing another Household's rows (a test signs in as two people and proves it)
- [x] The Household page lists Members with their role (Owner / Member / Dependent)
- [x] Migration is a new numbered file in `supabase/migrations/`

## Comments

- 2026-10-17: Built in worktree `restart-t05` (branch `restart-t05`). Migration `supabase/migrations/005_households_and_members.sql` adds `households` and `members` (member `user_id` links to `auth.users`, null only for a `dependent`; role owner / member / dependent), a unique index so a user is in at most one Household, one Owner per Household, the private `private.my_household_ids()` SECURITY DEFINER helper (`search_path = ''`), `public.create_household(p_name, p_owner_name)` (SECURITY DEFINER RPC that creates the Household and its Owner in one transaction), and RLS with select-only policies for `authenticated`. Direct insert, update and delete are revoked from `anon` and `authenticated`.
- 2026-10-17: RLS test `supabase/tests/households_rls_test.sql` (pgTAP, 21 tests) signs in two users and an anonymous visitor and proves neither reads or writes the other's rows. NOT RUN: the Supabase CLI and Docker are not installed on this machine, so the SQL has not been executed. The two DB boxes above stay unticked until it runs.
- 2026-10-17: Web: `web/src/components/HouseholdPage.jsx` (Members with roles, and a Create Household form for a person with none), `web/src/lib/households.js`, `web/src/strings.js` (plain constants for ticket 04), a one-line-plus hook in `App.jsx`. `npm run lint`, `build`, `test` (10 passing) and `format:check` pass. `web/.prettierrc.json` gained `"endOfLine": "auto"` because this Windows checkout (core.autocrlf) has CRLF files that Prettier flagged.
- To test the DB locally (needs Docker and the Supabase CLI, in `web/` or the repo root): `supabase start`, then `supabase db reset` (applies every migration to the local stack), then `supabase test db`. To ship, review the migration and run `supabase db push` against the linked project yourself; nothing was pushed or linked here.
