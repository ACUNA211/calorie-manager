# 36: Research: Meal Plan model test

**What to build:** Draft 4 real weeks of Meal Plans for this Household with Claude Haiku 5.5 and two other cheap models (pick from `.scratch/restart/research/costs.md`). Use the planned design: code pre-filters candidate Recipes, the model returns Recipe IDs per slot as JSON. Score each draft on rule breaks (ranges, band, Hard rules), how far from the Planning band, and whether the Household would eat it. Record real token counts.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A report in `.scratch/restart/research/` with scores, token counts and cost per plan per model
- [ ] A model pick for ticket 42, with the prompt and JSON shape used
- [ ] Total spend recorded (expected under $1)
