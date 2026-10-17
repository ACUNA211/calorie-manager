# 07: Dependents and "logging for"

**What to build:** The Owner can add a Dependent: a Member with a name but no login (such as a child). Every adult Member can choose "logging for" in the app header and act as that Dependent for logging and Targets. Dependents' data is visible to every adult in the Household.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 05 (Households and Members)

**Status:** ready-for-agent

- [ ] Owner can add, rename and remove a Dependent on the Household page
- [ ] The header has a "logging for" picker showing yourself and each Dependent
- [ ] While a Dependent is picked, screens that show a Member's data show the Dependent's
- [ ] A Dependent can never sign in (no user is linked)
