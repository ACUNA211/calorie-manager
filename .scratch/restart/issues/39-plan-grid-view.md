# 39: Plan grid (view)

**What to build:** Port the Plan week grid for the Household: Meal Times as rows, Sunday to Saturday as columns, each Cook coloured, with each Member's Portion and its calories. A Member filter shows one Member's view or everyone's. Read-only in this ticket.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 08 (Move shared tables into the Household), 22 (Shared Meal Times), 28 (Recipes page)

**Status:** done (awaiting you: run the database tests with `supabase test db` and push migration 038, then open Plan from More with real data)

- [ ] The grid shows the current week's Cooks and Portions from the database
- [x] Shared Meal Times show one Cook with a Portion per Member
- [x] Week arrows move between weeks; an empty week says it has no plan yet
- [x] Each day shows the total per Member against their band

## Comments

- 2026-10-19: Built read-only. No new tables: Meal Plan, Cooks and Portions already exist (001, 006, 007). Migration 038 adds one function, `plan_week(p_week_start)`, a security-definer read that returns only the caller's Household: the plan, Cooks (with Recipe name and calories per serving from `recipe_totals`), every Member's Portions, the Meal Times those Portions sit at (with their sharers), and each Member's band in calories (not the Calorie Target itself). Reason: Portions are private per Member (007, 032) and Meal Times only visible to their sharers (013), so a plain select cannot show everyone; 032 left this read rule to this ticket. Writes are untouched for ticket 40. Rows with the same Meal Time name and time share a grid row; only Meal Times with a Portion that week appear as rows. Day totals are planned Portion calories per Member against band (under / in / over; no band when no Calorie Target). Reached at `/plan`, linked from More (not a tab). Checked: lint, build, format:check, 1009 unit and component tests pass. Not checked: pgTAP `supabase/tests/plan_week_test.sql` (written, never run, no local stack) and the page against a real database, so the first box stays unticked.
