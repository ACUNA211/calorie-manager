# 26: Scan into the Pantry

**What to build:** A Scan button on the Pantry: scanning a package adds one package to the Pantry at its label weight (the food's package or serving data), using the same lookup as ticket 18.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 25 (Pantry page), 18 (Scan finds a food)

**Status:** ready-for-agent

- [ ] Scanning a known product adds one package at its label weight
- [ ] Scanning the same product again adds another package
- [ ] If the package weight is unknown, ask for it once and remember it on the food
