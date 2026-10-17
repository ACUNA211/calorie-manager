# 31: Week view

**What to build:** The Week view per Member (Sunday to Saturday): each day's calories and macros against Targets and the Planning band, the count of days under, and the week's average. Tapping a day opens it on Today. Week arrows move between weeks.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 23 (Today: log a food)

**Status:** ready-for-agent

- [ ] Each day shows calories vs Target and band, and macros vs Targets
- [ ] Days under and the weekly average are correct (unit-tested on sample data)
- [ ] Tapping a day opens Today on that day
- [ ] Days with nothing logged show as empty, not as zero calories
