# 23: Today: log a food

**What to build:** The Today screen for the current Member: the day bar (eaten vs Calorie Target and band, plus protein, carbs and fat against Targets), the day's Meal Times with what's logged, and "Log food": search a food, pick an amount, and it's logged at the current Meal Time (or a chosen one) with calories and macros. Day arrows move between days; future days are read-only.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 10 (Targets by hand), 14 (Food search page), 21 (Meal Times page)

**Status:** ready-for-agent

- [ ] Logging a food adds an entry with calories and macros at the right Meal Time
- [ ] The day bar updates straight away and shows calories and macros left
- [ ] The default Meal Time is the one nearest the current time
- [ ] Day arrows work; future days can't be logged
- [ ] Logging for a Dependent works through "logging for"
