# 18: Scan finds a food

**What to build:** A Scan button on the Foods screen: camera → barcode → the existing GTIN lookup (Food Library first, then USDA Branded) → the food is shown with calories and macros, ready to save. If nothing matches, say so and offer search (tickets 19 and 20 add the fallbacks).

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 14 (Food search page), 17 (Barcode phone test)

**Status:** ready-for-agent

- [ ] Scanning a known product shows it within a few seconds
- [ ] Scanning a product already in the Food Library doesn't call USDA
- [ ] An unknown code shows "Not found" with a search button, never a dead end
- [ ] The lookup tries the 12-digit and 13-digit forms of the code (tested with zero-padded codes)
