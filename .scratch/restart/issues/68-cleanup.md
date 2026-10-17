# 68: Cleanup

**What to build:** Once the PWA covers logging, the Shopping list and Rebalance, retire what it replaces: the Claude artifact app, the three `-cal` skills, the Estimate path and the `estimated` food source, and the old barcode test page. Update `CONTEXT.md` and the README to match.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 23 (Today: log a food), 46 (Shopping list from approve), 59 (Rebalance in the app)

**Status:** ready-for-agent

- [ ] The old artifact, skills and barcode test page are removed or archived
- [ ] No food uses the `estimated` source (migrated or removed)
- [ ] CONTEXT.md and the README describe only the new app

- 2026-10-17 (dispatcher): include `skills/plan-week-cal` and `skills/rebalance-cal`, which still read Meal Time range columns that migration 013 removed.
