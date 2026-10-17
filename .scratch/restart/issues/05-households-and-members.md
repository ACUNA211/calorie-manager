# 05: Households and Members

**What to build:** Add Households and Members as in `CONTEXT.md`: a Household table, a Member table (linked to a Supabase user, or no user for a Dependent), and the Owner. A signed-in person with no Household can create one and becomes its Owner. Add row-level security through a `SECURITY DEFINER` helper in a private schema that returns the caller's Household ids, used as `(select ...)` in policies. Add a Household page listing its Members.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 02 (App skeleton and sign-in)

**Status:** ready-for-agent

- [ ] Creating a Household makes the creator its Owner and only Member
- [ ] A person belongs to at most one Household (enforced in the database)
- [ ] Policies stop a signed-in person from reading or writing another Household's rows (a test signs in as two people and proves it)
- [ ] The Household page lists Members with their role (Owner / Member / Dependent)
- [ ] Migration is a new numbered file in `supabase/migrations/`
