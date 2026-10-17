# 42: AI draft

**What to build:** A server function drafts next week's Meal Plan: code picks candidate Recipes per Meal Time (Hard-rule filter, ranges, Preferences, Leftovers later), the model chosen in ticket 36 assigns Recipe ids to slots as compact JSON, code sizes the Portions, the validator checks it, and only failing slots go back to the model to repair (at most 2 rounds). The result is saved as a draft. A "Draft this week" button on the Plan grid runs it.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 41 (Plan validator), 12 (AI cap counter), 36 (Research: Meal Plan model test)

**Status:** ready-for-agent

- [ ] "Draft this week" produces a saved draft that passes the validator, or shows what still fails
- [ ] The model only ever sees Recipe ids that code allowed
- [ ] The call goes through the AI cap helper and is refused over the cap
- [ ] Tests use recorded model responses (no live AI in tests)
- [ ] Token counts per draft are logged
