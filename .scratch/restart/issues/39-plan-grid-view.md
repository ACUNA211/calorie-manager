# 39: Plan grid (view)

**What to build:** Port the Plan week grid for the Household: Meal Times as rows, Sunday to Saturday as columns, each Cook coloured, with each Member's Portion and its calories. A Member filter shows one Member's view or everyone's. Read-only in this ticket.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 08 (Move shared tables into the Household), 22 (Shared Meal Times), 28 (Recipes page)

**Status:** ready-for-agent

- [ ] The grid shows the current week's Cooks and Portions from the database
- [ ] Shared Meal Times show one Cook with a Portion per Member
- [ ] Week arrows move between weeks; an empty week says it has no plan yet
- [ ] Each day shows the total per Member against their band
