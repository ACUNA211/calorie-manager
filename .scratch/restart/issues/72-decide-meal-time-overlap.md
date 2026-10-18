# 72: Decide: when do two Meal Times overlap?

**Type:** your task (not for an agent)

**What to do:** Ticket 21 counts two Meal Times on the same day as overlapping when they're within 45 minutes of each other, the rule from the old Meal Times prototype. The ticket said "same time". Pick 45 minutes, exact same time, or another window. Also skim the Spanish kind names (Fijo, Planificado, Si hay espacio).

Ticket 22 (Shared Meal Times) added two more questions:

- **If room calories:** the form check (`validateMealTime`) still wants both a minimum and a maximum for an If room Meal Time, but the new `needsCalories` check wants only a maximum. Pick one rule.
- **New sharers' range:** when you add a Member to a shared Meal Time, the editor copies your range to them. Keep that, or ask each new sharer for their own range.
- Skim the new Spanish strings (Compartido con, Dejar de compartir).

**Blocked by:** None (can start immediately)

**Status:** done

**Unblocks:** 21, 22

- [x] Rule chosen and written in ticket 21's Comments
- [x] Spanish kind names approved or corrected
- [x] If room rule and new-sharer range chosen and written in ticket 22's Comments

## Comments

2026-10-17: Overlap = exact same time. If room = maximum only. New sharers are asked for their own range. All Spanish strings approved. Code changes noted in 21 and 22.
