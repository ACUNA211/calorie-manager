# 49: Scan ticks Bought

**What to build:** A Scan button on the Shopping list: scanning a product ticks its line as Bought and adds the real package size to the Pantry instead of the planned amount. A product with no line is added to the Pantry with a note.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 47 (Bought / Have it), 18 (Scan finds a food)

**Status:** ready-for-agent

- [ ] Scanning a product on the list ticks its line and adds the package weight
- [ ] Scanning something not on the list asks to add it to the Pantry
- [ ] Works with the lookups from tickets 18–20
