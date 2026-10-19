# 103: Decide: Plan validator rules

**Type:** your task (not for an agent)

**What to do:** Ticket 41's validator (`web/src/lib/planValidator.js`) made four calls. Confirm or change each in this ticket's Comments; an agent then adjusts the code and tests.

1. A Planned Meal Time is checked against both ends of the Member's range; an If room Meal Time only against its maximum.
2. Any Portion placed at a Set Meal Time is a failure.
3. Set Meal Time calories count toward the Member's day when it's checked against their band. (The grid's own day-total row leaves them out, so a "day over/under" warning's number can differ from the row. Say whether the row should include them too.)
4. A day where a Member has no Meal Time and no Portion isn't checked, and a Member with no band is skipped.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

**Unblocks:** 41

- [ ] All four answered in Comments
