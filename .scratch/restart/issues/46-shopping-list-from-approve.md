# 46: Shopping list from approve

**What to build:** Adapt the existing shopping list functions: approving a Meal Plan adds a line per food for what the plan needs minus what the Pantry holds, in one shopping measure (the unit stores sell in), ordered by store section. Each line shows the date it was added. Port the Shopping list screen.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 45 (Approve), 25 (Pantry page)

**Status:** ready-for-agent

- [ ] Approving adds lines only for foods the Pantry doesn't fully cover (tested with sample Pantry amounts)
- [ ] Lines group by store section and show their date
- [ ] Changing the plan after approval adds a new line for any extra need; existing lines aren't rewritten
- [ ] Every Member sees the same list

## Comments

- 2026-10-19: From ticket 45: `plan_approve()` (migration 041) ends by calling the existing `sync_shopping_list(plan_id)`, marked "HOOK (46)", only when a plan is newly approved or was edited since approval. Replace or keep that one call here.
