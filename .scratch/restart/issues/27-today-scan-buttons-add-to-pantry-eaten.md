# 27: Today scan buttons: Add to Pantry / Eaten

**What to build:** A Scan button on Today: the scanned food is shown with two buttons. **Add to Pantry** adds the package (as in ticket 26). **Eaten** logs it at the current Meal Time (with an amount picker) and, if the food is in the Pantry, takes that amount off the Pantry.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 23 (Today: log a food), 25 (Pantry page), 18 (Scan finds a food)

**Status:** ready-for-agent

- [ ] Both buttons appear after a scan on Today
- [ ] Eaten logs at the current Meal Time with calories and macros
- [ ] Eaten takes the amount off the Pantry when the food is there, and doesn't fail when it isn't
- [ ] Undo reverses both the log and the Pantry change
