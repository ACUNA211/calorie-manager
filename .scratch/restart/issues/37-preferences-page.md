# 37: Preferences page

**What to build:** Preferences from `CONTEXT.md`. Household Preferences (cuisines, weeknight and weekend cooking time, equipment, how often meals repeat, how many leftovers are fine, budget feel), editable by any Member. Member Preferences: favourites and dislikes (soft) and Hard rules (allergies, foods they won't eat, diet rules such as vegetarian or halal).

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 09 (Move personal tables to Members)

**Status:** done (awaiting you to run the database tests with `supabase test db` on a local stack and push migration 037)

- [x] Household and Member Preferences save and reload (component tests against a fake client; not run against a real database)
- [x] Hard rules can name foods, food groups or a diet rule from a fixed list (unit and component tests; the same lists are check constraints in 037, untested until the database tests run)
- [ ] Each Member edits their own Member Preferences; adults edit Dependents'

## Comments

- 2026-10-19: Built migration 037 (household_preferences, member_preferences, RLS), pgTAP test `supabase/tests/preferences_test.sql` (16 assertions, NOT run: no local stack), the Preferences page at `/preferences` (link on More), logic and component tests. Third box (each Member edits their own, adults edit Dependents') left unticked: it rests on the RLS policies, which only the pgTAP test can verify.
