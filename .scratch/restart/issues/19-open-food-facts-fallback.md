# 19: Open Food Facts fallback

**What to build:** When USDA has no match for a barcode, look it up in Open Food Facts. Store OFF products unmodified in their own table (per the ODbL notes in `.scratch/restart/research/costs.md`) and show an "Open Food Facts" credit with a link wherever an OFF food appears. Send the required custom User-Agent and stay under 15 reads a minute.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 18 (Scan finds a food), 69 (Run the database tests locally), 83 (Deploy the Edge Functions and set their secrets), 85 (Decide: how are Open Food Facts foods logged and stocked?)

**Status:** done (awaiting review)

- [ ] A product missing from USDA but present in OFF is found and can be used like any food
- [ ] OFF rows live in their own table, never merged or edited into the Food Library
- [x] An attribution line with a link shows on screens that show OFF data
- [x] Requests send a custom User-Agent and are rate-limited (tested)
- 2026-10-17: Built in worktree `restart-t19` (branch `restart-t19`). When `usda_lookup_gtin` misses, `lookupGtin` (`web/src/lib/foods.js`) asks Open Food Facts through `lookupOff` (`web/src/lib/off.js`), which calls the Edge Function `off-lookup` (`supabase/functions/off-lookup/index.ts`). The pure logic is in `supabase/functions/_shared/off.ts`: code normalising, the 15-reads-a-minute `canRead`, the request (User-Agent `CalorieManager/1.0 (https://github.com/ACUNA211/calorie-manager)` unless the `OFF_USER_AGENT` secret is set), and `lookupOffProduct` with fakes for clock, store and fetch. Products are stored as returned in `off_products` (migration `026_open_food_facts.sql`, RLS: signed-in read, no client writes); reads are logged in `off_read_log` (no client access). The scan shows an OFF food with calories, macros and an "Open Food Facts" credit link (`web/src/components/OffCredit.jsx`). OFF is never written to `foods`. Rate-limited or failed OFF calls show "try again" rather than "not found". Checks (measured, `web/`): `npm run lint` clean, `npm run build` ok, `npm test` 44 files / 642 tests pass (`off.test.js` 23 tests with a fake fetch only; 6 added to `foods.test.js`, 2 to `FoodsScan.test.jsx`), `npm run format:check` clean. Prettier applied to the Supabase `.ts` files; the Deno code was not type-checked or run. Not run: `supabase/tests/open_food_facts_test.sql` (ticket 69), the Edge Function (not deployed; ticket 83), and a live OFF call (not made). Open decision: an OFF food cannot be logged or put in the Pantry yet, because `calorie_log` and `pantry_items` reference `foods`; saving it needs a decision that does not merge OFF rows into the Food Library.
- 2026-10-18: `supabase db reset` (001–033) and `supabase test db` run on the local stack: 22 files, 387 tests, all pass.
