# 16: Spanish food names

**What to build:** Each food has an English name and a Spanish name. When a food is saved, a server function fills the Spanish name with the provider picked in ticket 15 (through the AI cap helper). A Member can edit either name. Search matches both names, and Spanish screens show the Spanish name.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 14 (Food search page), 15 (Research: translation API free tiers), 12 (AI cap counter)

**Status:** ready-for-agent

- [ ] New foods get a Spanish name on save; existing foods are backfilled once
- [ ] Editing the Spanish name keeps the edit (it's never overwritten)
- [ ] Searching "manzana" finds "Apples, raw"
- [ ] If translation fails, the food still saves with an empty Spanish name
