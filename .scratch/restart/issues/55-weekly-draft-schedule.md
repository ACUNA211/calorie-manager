# 55: Weekly draft Schedule

**What to build:** A Schedule (pg_cron) runs the AI draft once a week, Friday 6pm Household time by default; the Owner can change the day and time. When the draft is ready, Members get a "Next week's plan is ready" notification.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 42 (AI draft), 54 (Web Push setup)

**Status:** ready-for-agent

- [ ] The draft runs at the set day and time (testable by setting it a minute ahead)
- [ ] The Owner can change the day and time in Settings
- [ ] A draft-ready notification goes to every Member with notifications on
- [ ] If the AI cap is reached, the notification says so instead
