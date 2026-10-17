# 64: Intake form

**What to build:** An Intake form a Member fills in when joining (and can redo): the questions and formula from ticket 01's research. It suggests Targets, which the Member accepts or edits before they're saved. Dependents get no suggestion.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 01 (Research: which formula and calculator should the Intake form use?), 10 (Targets by hand)

**Status:** ready-for-agent

- [ ] The form asks the questions ticket 01 recommends, in both languages
- [ ] The formula is a pure, unit-tested function matching ticket 01's examples
- [ ] Suggested Targets are only saved after the Member accepts or edits them
