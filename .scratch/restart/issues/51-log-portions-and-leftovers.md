# 51: Log Portions and Leftovers

**What to build:** On Today, logging a planned Portion takes it out of its Cook, not the Pantry. Servings of a made Cook that no logged Portion has used show as Leftovers (in a Leftovers list on Today and the Pantry). Leftovers older than 4 days (editable) are flagged. Leftovers can be eaten (logged) or thrown out.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 50 (Cook made), 23 (Today: log a food)

**Status:** ready-for-agent

- [ ] Logging a planned Portion reduces the Cook's remaining servings
- [ ] Leftovers list shows each made Cook's remaining servings and age
- [ ] Leftovers over 4 days old are flagged; the limit is a Household setting
- [ ] Throwing out records it (for ticket 53) and removes the Leftovers
