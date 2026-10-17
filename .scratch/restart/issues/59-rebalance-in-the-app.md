# 59: Rebalance in the app

**What to build:** On Today, when a day is heading over, a "Rebalance" button opens a box: the Member types (or later says) what happened. Jev rates it: which meal, how far over (a score, used if no number), which fix they want (rest of today, drop If room, spread over the week, do nothing) and confidence. Code pulls out any stated calories. The formulas from ticket 57 make up to 3 options shown as cards; nothing changes until the Member picks one, and Undo puts it back. Low confidence asks one clarifying choice first.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 57 (Rebalance formulas), 58 (Decision-model interface), 51 (Log Portions and Leftovers)

**Status:** ready-for-agent

- [ ] Typing a message shows up to 3 option cards with where the day lands
- [ ] Picking one applies it; Undo restores the old Portions
- [ ] A stated number ("I ate about 1,800") is used instead of Jev's score (tested)
- [ ] Low confidence shows a clarifying choice instead of options
