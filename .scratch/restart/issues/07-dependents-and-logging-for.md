# 07: Dependents and "logging for"

**What to build:** The Owner can add a Dependent: a Member with a name but no login (such as a child). Every adult Member can choose "logging for" in the app header and act as that Dependent for logging and Targets. Dependents' data is visible to every adult in the Household.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 05 (Households and Members), 69 (Run the database tests locally), 82 (Decide: does "logging for" survive a reload?)

**Status:** done (awaiting review)

- [x] Owner can add, rename and remove a Dependent on the Household page
- [x] The header has a "logging for" picker showing yourself and each Dependent
- [ ] While a Dependent is picked, screens that show a Member's data show the Dependent's
- [ ] A Dependent can never sign in (no user is linked)

## Comments

- 2026-10-17: Built. Migration `014_dependents.sql` (add/rename/remove Dependent RPCs, Owner only; reads and writes of a Dependent's rows already covered by 007), with `supabase/tests/dependents_test.sql` (24 assertions, not run). Web: `LoggingForSwitch`, `actingMember.jsx` provider, Targets follow the picked Member, Owner's Dependents editor on the Household page. Vitest: 197 tests pass. Ticked the picker and Owner-editor boxes on Vitest evidence only (fake Supabase client). Not ticked: "screens show the Dependent's data" (only Targets is wired; the Meal Times and Today screens are other tickets and must read `useActingMember()`), and "a Dependent can never sign in" (enforced by the 005 constraint, not re-tested here). Waiting on ticket 69 to run `supabase test db`.
- 2026-10-18: `supabase db reset` (001–033) and `supabase test db` run on the local stack: 22 files, 387 tests, all pass.
