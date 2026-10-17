# 31: Week view

**What to build:** The Week view per Member (Sunday to Saturday): each day's calories and macros against Targets and the Planning band, the count of days under, and the week's average. Tapping a day opens it on Today. Week arrows move between weeks.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 23 (Today: log a food), 79 (Review Release 1 work and push it)

**Status:** done (awaiting review)

- [x] Each day shows calories vs Target and band, and macros vs Targets
- [x] Days under and the weekly average are correct (unit-tested on sample data)
- [ ] Tapping a day opens Today on that day
- [x] Days with nothing logged show as empty, not as zero calories

## Comments

- 2026-10-17: Built in worktree `t31` (branch `restart-t31`). Week view in `components/WeekPage.jsx` (Sunday to Saturday, week arrows, one button per day, days under and averages). Pure rules in `lib/weekLogic.js`; one query per week, `loadWeek` in `lib/week.js`, reading the acted-as Member's `calorie_log` between the two dates. Days under: logged days at or below the Calorie Target. Averages and macro totals use logged days only; an empty day shows "Nothing logged". App.jsx: one import, a `selectedDay` state, the WeekPage render, and a `day` prop on TodayPage (4 changed lines). TodayPage.jsx: the `day` prop starts Today on that day and scrolls it into view (5 changed lines). Today remounts on each tap (the key is `Date.now()`), so tapping the same day again still opens it. Locale namespace `week` in en and es. No migration. The weight trend is not included (ticket 32). Measured in `web/`: `npm run lint` passes; `npm run build` passes; `npm run format:check` passes; `npm test` 47 files, 647 tests pass (36 of them new, in 4 files: weekLogic 20, WeekPage 10, TodayOpenDay 3, week 3). Tests use mocked Supabase and a fixed date; nothing ran against a database or in a browser. "Tapping a day opens Today" is not ticked: the tap and the day prop are each tested, but no test drives the App wiring end to end. Not run: the pgTAP tests (none added), RLS for a Dependent's week, and any preview.
