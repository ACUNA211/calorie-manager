# 79: Review Release 1 work and push it

**Type:** your task (not for an agent)

**What to do:** Everything the agents built sits on the local `restart` branch, nothing pushed. Skim each "done (awaiting review)" ticket and its files, then tell Claude to push `restart` (or to open a PR into the remote branch). The tickets: 01, 02, 03, 04, 05, 06, 08, 09, 10, 12, 13, 15, 17, 21, 35, 36. Added in the 2026-10-17 run: 07, 14, 16, 18, 19, 22, 23, 24, 25, 26, 28, 29, 30, 31, 32, 33, 34, 11, 20, 27, and the fix in migration 024 (USDA grants).

While reviewing, open the app in a browser at phone width (`npm run dev` in `web/`) and check: the Today edit panel and Undo toast (24), tapping a day on the Week view opens Today on it (31, then tick its box), and the Recipe editor layout (28). Spot-check that Spanish screens still read well: the dispatcher's merge script took the union of locale keys, and on one merge (#11) it kept older values, which was caught and fixed; skim `es.json` for leftovers. Ticket 21's overlap question is new wording: approve or correct `clash.question` in `web/src/locales/es.json` ("{{name}} es a la misma hora que {{other}} los {{days}}. ¿Quitar {{days}} de {{other}}?"). Ticket 22 added sharer strings under `mealTimes.form.sharer*`, `mealTimes.form.sharersHint`, `mealTimes.errors.sharerRangeMissing` and `mealTimes.calories.upTo` ("Hasta {{max}} kcal"); note `sharersHint` uses Spain's "estáis", which you may want as "están". Also delete the empty folder `D:/x`, which an agent created by mistake.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

**Unblocks:** 04, 24, 28, 31

- [ ] Work reviewed
- [ ] Spanish overlap question (21) approved or corrected
- [ ] Spanish sharer strings (22) approved or corrected
- [ ] Branch pushed or PR opened
