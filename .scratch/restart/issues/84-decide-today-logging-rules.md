# 84: Decide: Today logging rules

**Type:** your task (not for an agent)

**What to do:** Ticket 23 (Today: log a food) made these calls. Confirm or change each one in ticket 23's Comments.

1. Logging a USDA search result first saves that food into the Household's Food Library, so the entry gets macros. (Side effect: the library grows with everything you log.)
2. On a past day, the default Meal Time is still the one nearest the current clock time.
3. Future days can be viewed but not logged.
4. Entry values are rounded to one decimal.

Ticket 24 (edit, delete, undo) added one more; answer it in ticket 24's Comments:

5. **Undo after delete gives a new id.** Undo puts back every value (date, Meal Time, time, amount, calories, macros, food, original created time) but the row gets a new id, because `calorie_log.id` is "generated always". Is that fine, or must it keep the same id (needs a migration)?

Ticket 34 (Offline logging) adds one more; answer it in ticket 34's Comments:

6. **A refused queued entry.** When the server refuses an entry that was logged offline, it shows an error with Try again and Discard, and the entries queued after it wait (kept in order). Keep that, or skip it and send the rest?

Ticket 27 (Today scan buttons) adds one more; answer it in ticket 27's Comments:

7. **"Eaten" offline.** Eaten logs the food and takes it off the Pantry, so it needs a connection (the Pantry change isn't queued). Is that fine, or should Eaten work offline too (queue the Pantry change as well)?

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

**Unblocks:** 23, 24, 27, 34

- [ ] Four answers written in ticket 23's Comments
- [ ] Answer 5 written in ticket 24's Comments
- [ ] Answer 6 written in ticket 34's Comments
- [ ] Answer 7 written in ticket 27's Comments
