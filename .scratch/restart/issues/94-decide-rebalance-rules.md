# 94: Decide: Rebalance rules left open by ticket 57

**Type:** your task (not for an agent)

**What to do:** Ticket 57 built the Rebalance formulas in `web/src/lib/rebalanceLogic.js` and made four calls you should confirm or change. Answer each in this ticket's Comments; an agent then adjusts the code and tests.

1. **Spreading over the week.** Spreading takes up to 10% of the Calorie Target from each later day, so today can still end over its Target while the week fits. Is that fine, or should the app label it "week fits, today doesn't" (or not offer it)?
2. **Range.** The lowest a Planned Portion may shrink to is checked per Meal Time (the Meal Time's `calMin`), not per Portion. Is per Meal Time right?
3. **Later days already over.** A later day that is already over its Target still gives calories, up to the 10% cap. Should it give nothing instead?
4. **The 10% cap.** It is a parameter only. Should each Member get a setting for it (needs a migration and a Settings control in ticket 91), or is a fixed 10% enough?

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

**Unblocks:** 59 (Rebalance in the app)

- [ ] All four answered in Comments
