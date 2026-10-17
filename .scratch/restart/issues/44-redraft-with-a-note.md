# 44: Redraft with a note

**What to build:** "Redraft" on the Plan grid takes a typed note for the whole week ("less chicken", "more leftovers") and re-runs the draft with that note added. The new draft replaces the old one only when the Member accepts it.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 42 (AI draft)

**Status:** ready-for-agent

- [ ] The note is passed to the model; the new draft passes the validator
- [ ] The Member sees the new draft before it replaces the old one
- [ ] Each redraft is recorded in the AI ledger
