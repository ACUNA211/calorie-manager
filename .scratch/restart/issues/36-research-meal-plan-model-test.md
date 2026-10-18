# 36: Research: Meal Plan model test

**What to build:** Draft 4 real weeks of Meal Plans for this Household with Claude Haiku 5.5 and two other cheap models (pick from `.scratch/restart/research/costs.md`). Use the planned design: code pre-filters candidate Recipes, the model returns Recipe IDs per slot as JSON. Score each draft on rule breaks (ranges, band, Hard rules), how far from the Planning band, and whether the Household would eat it. Record real token counts.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 78 (Rate the meal plan test drafts)

**Status:** partly done: waiting on API keys

**Comments:** 2026-10-17: test kit built in research/meal-plan-test/ (inputs, pre-filter, prompt, output shape, scorer, runner). Scorer checked on a valid and a broken hand-written draft (0 and 15 rule breaks). No live model runs: waiting on ANTHROPIC_API_KEY, GOOGLE_API_KEY and OPENAI_API_KEY, and on the Gemini and gpt-6-luna model ids. Design and pending list in research/meal-plan-model-test.md.

- [ ] A report in `.scratch/restart/research/` with scores, token counts and cost per plan per model
- [ ] A model pick for ticket 42, with the prompt and JSON shape used
- [ ] Total spend recorded (expected under $1)
- 2026-10-17 (#77): Household data added. Brenda (member-2, adult, 2,000 kcal) is in `inputs/member-2.json`: plain copies of member-1's Breakfast (at 11:00), Snack, Dinner and Dessert, no lunch, not shared Meal Times. No Hard rules for anyone. The kit still handles one Member: extend `lib/slots.mjs`, the prompt and `scorer.mjs` to plan and score each Member's days against their own Target, then rerun. Note her copied ranges top out at 1,500 kcal (Sun–Thu) and 1,800 (Fri/Sat), under her 1,800–2,000 band, so the scorer will flag band misses until her ranges are raised.
