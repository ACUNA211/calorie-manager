# 56: Meal Time and cook-day reminders

**What to build:** Reminders through Web Push: a reminder before each of a Member's Meal Times ("Dinner at 6:30, chili"), and on cook days ("Start the chili today"). Each Member chooses which reminders they get and how many minutes before.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 54 (Web Push setup), 50 (Cook made), 21 (Meal Times page)

**Status:** ready-for-agent

- [ ] A Member can turn Meal Time reminders and cook-day reminders on or off separately
- [ ] Reminders arrive at the chosen offset (pg_cron job, tested with a near time)
- [ ] Reminder text is in the Member's language
