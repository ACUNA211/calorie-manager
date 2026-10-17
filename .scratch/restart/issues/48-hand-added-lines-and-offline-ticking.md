# 48: Hand-added lines and offline ticking

**What to build:** Members can add any line by hand (food or not, with an optional amount). Ticking and adding lines works with no signal and syncs later, using the same queue as ticket 34.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 46 (Shopping list from approve), 34 (Offline logging)

**Status:** ready-for-agent

- [ ] A hand-added line appears for every Member
- [ ] With the network off, ticking and adding lines work and sync when back online
- [ ] Two Members ticking the same line offline doesn't double the Pantry amount
