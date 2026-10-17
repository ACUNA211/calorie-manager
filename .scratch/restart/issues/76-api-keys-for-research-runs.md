# 76: Get API keys and run the research tests

**Type:** your task (not for an agent)

**What to do:** Tickets 15, 35 and 36 have ready-to-run scripts that wait on keys. Create the accounts and keys yourself and set them only in your terminal's environment, never in a file. The keys: `GOOGLE_TRANSLATE_KEY` and/or `AZURE_TRANSLATOR_KEY` + `AZURE_TRANSLATOR_REGION` (15); `OPENAI_API_KEY`, `TYPESAFE_API_KEY` + `JEV_URL` (35); `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `OPENAI_API_KEY` (36). Then run `node scripts/translate-test.mjs`, `node .scratch/restart/research/decisions-test/run-decisions-test.mjs` (smoke test first: `--provider openai --limit 1`) and `node runner.mjs --all` in `.scratch/restart/research/meal-plan-test/`. Expected spend is under $3 in total. Ask Claude to write up the results afterwards.

**Blocked by:** 77 (Give the meal plan test its Household data)

**Status:** ready-for-human

**Unblocks:** 15, 35, 78

- [ ] Translation test output saved
- [ ] Decisions test results saved
- [ ] Meal plan test drafts saved
- [ ] Total spend noted
