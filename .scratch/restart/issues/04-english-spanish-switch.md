# 04: English/Spanish switch

**What to build:** Every string the app shows comes from translation files, one per language, starting with English and Spanish. Each Member can switch language; the choice is remembered on their account (a local default is fine until ticket 05 lands, then store it on the Member). Dates and numbers follow the chosen language. Adding a third language later must only need a new file.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 02 (App skeleton and sign-in)

**Status:** ready-for-agent

- [ ] No user-facing string is hard-coded in components (a lint rule or test checks this)
- [ ] A language switch changes every visible string between English and Spanish without reloading
- [ ] Dates and numbers format per language (e.g. "vie, 17 oct" vs "Fri, Oct 17")
- [ ] A test fails if a key exists in one language file but not the other
