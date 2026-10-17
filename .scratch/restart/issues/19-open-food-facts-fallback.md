# 19: Open Food Facts fallback

**What to build:** When USDA has no match for a barcode, look it up in Open Food Facts. Store OFF products unmodified in their own table (per the ODbL notes in `.scratch/restart/research/costs.md`) and show an "Open Food Facts" credit with a link wherever an OFF food appears. Send the required custom User-Agent and stay under 15 reads a minute.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 18 (Scan finds a food)

**Status:** ready-for-agent

- [ ] A product missing from USDA but present in OFF is found and can be used like any food
- [ ] OFF rows live in their own table, never merged or edited into the Food Library
- [ ] An attribution line with a link shows on screens that show OFF data
- [ ] Requests send a custom User-Agent and are rate-limited (tested)
