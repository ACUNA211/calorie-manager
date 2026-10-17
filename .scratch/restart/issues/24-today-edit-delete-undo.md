# 24: Today: edit, delete, undo

**What to build:** On Today, tapping a log entry lets the Member change its amount or Meal Time, or delete it. Every log, change and delete shows a toast with Undo for a few seconds.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 23 (Today: log a food)

**Status:** ready-for-agent

- [ ] Editing an entry's amount recalculates calories and macros
- [ ] Deleting shows Undo; Undo restores the entry exactly
- [ ] Logging shows Undo; Undo removes the entry
