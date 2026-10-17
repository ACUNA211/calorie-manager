# 20: Type in a label for an unknown barcode

**What to build:** When neither USDA nor Open Food Facts knows a barcode, the Member types in the Nutrition Facts label: name, brand, serving size in grams, calories and the six macros per serving. It's saved to the Food Library with that barcode, so the next scan finds it.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 18 (Scan finds a food)

**Status:** ready-for-agent

- [ ] The form converts per-serving values to per 100 g correctly (tested)
- [ ] The saved food has the scanned barcode, and scanning it again finds it straight away
- [ ] The food is marked as typed from a label
- [ ] Validation stops obvious typos (calories far from 4·carb + 4·protein + 9·fat asks to confirm)
