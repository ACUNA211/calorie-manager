# 14: Food search page

**What to build:** A Foods screen: type to search the Food Library first and USDA second (using the existing USDA search function), see calories and macros per 100 g and per serving, and save a USDA result into the Food Library. Search ignores accents and case (port the old `norm` helper).

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 13 (Macros in the Food Library), 04 (English/Spanish switch)

**Status:** ready-for-agent

- [ ] Results show Food Library matches first, then USDA
- [ ] Each result shows calories and macros per serving and per 100 g, in the Member's units
- [ ] Saving a USDA result adds it once (no duplicates on a second save)
- [ ] Works in English and Spanish screens
