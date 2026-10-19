# 23: Today: log a food

**What to build:** The Today screen for the current Member: the day bar (eaten vs Calorie Target and band, plus protein, carbs and fat against Targets), the day's Meal Times with what's logged, and "Log food": search a food, pick an amount, and it's logged at the current Meal Time (or a chosen one) with calories and macros. Day arrows move between days; future days are read-only.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 10 (Targets by hand), 14 (Food search page), 21 (Meal Times page), 69 (Run the database tests locally), 84 (Decide: Today logging rules)

**Status:** done (awaiting review)

- [x] Logging a food adds an entry with calories and macros at the right Meal Time
- [x] The day bar updates straight away and shows calories and macros left
- [x] The default Meal Time is the one nearest the current time
- [x] Day arrows work; future days can't be logged
- [ ] Logging for a Dependent works through "logging for"

## Comments

- 2026-10-17: Built in worktree `t23` (branch `restart-t23`). Today screen for the acted-as Member: `TodayPage.jsx` (day arrows, future days read-only, Log food toggle), `DayBar.jsx` (calories against Target and band, protein floor, carbs and fat ranges), `TodayMeals.jsx` (Meal Times with their ranges and entries, plus "another time"), `LogFoodPanel.jsx` (search through `searchFoods`, amount in grams or servings, Meal Time defaulting to the nearest one now, USDA results saved to the Food Library before logging). Pure rules in `lib/todayLogic.js`, data access in `lib/today.js`. Migration `018_calorie_log_macros.sql` adds nullable `protein_g`, `carbs_g`, `fat_g` to `calorie_log`; pgTAP test `supabase/tests/calorie_log_macros_test.sql` (9 checks). App.jsx: one import and one render line. Locale namespace `today` in en and es. Measured in `web/`: `npm run lint` passes; `npm run build` passes; `npm run format:check` passes; `npm test` 31 files, 386 tests pass (of which 62 are `todayLogic.test.js`, 15 in `today.test.js` and `TodayPage.test.jsx` together). Tests use mocked Supabase, so the boxes for the entry row and the day bar are checked against the mocks only. Not run: the pgTAP test and migration 018 (ticket 69), RLS for a Dependent's entries, and any run against a real database or browser. The "logging for a Dependent" box is not ticked: the page reads and writes the acted-as Member, but no test exercises a Dependent's insert against the database.
- 2026-10-18: `supabase db reset` (001–033) and `supabase test db` run on the local stack: 22 files, 387 tests, all pass.
