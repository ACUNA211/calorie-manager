# 16: Spanish food names

**What to build:** Each food has an English name and a Spanish name. When a food is saved, a server function fills the Spanish name with the provider picked in ticket 15 (through the AI cap helper). A Member can edit either name. Search matches both names, and Spanish screens show the Spanish name.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 14 (Food search page), 15 (Research: translation API free tiers), 12 (AI cap counter), 69 (Run the database tests locally), 76 (Get API keys and run the research tests), 83 (Deploy the Edge Functions and set their secrets)

**Status:** done (awaiting translation key)

- [ ] New foods get a Spanish name on save; existing foods are backfilled once
- [ ] Editing the Spanish name keeps the edit (it's never overwritten)
- [x] Searching "manzana" finds "Apples, raw" (FoodsPage test with fixture rows; not against a database)
- [ ] If translation fails, the food still saves with an empty Spanish name

## Comments

- 2026-10-17: Built in worktree `restart-t16` (branch `restart-t16`). Migration `supabase/migrations/017_spanish_food_names.sql` adds `foods.name_es`, `name_es_edited_by_member` and `name_es_attempted_at`, a trigger that marks any non-translator change to `name_es` as a Member edit (the flag cannot be cleared by a plain update), and `public.apply_food_spanish_name(bigint, text)` (service role only), the translator's only write path. Edge Function `supabase/functions/translate-food-name/` (`{ food_id }` on save, `{ backfill: true, limit }` for the one-time backfill, 1 to 25 foods per call, returns `remaining`) reads the caller's JWT for visibility, makes the paid call through `createAiGate`, and tries Google Cloud Translation Basic first, Azure F0 on failure. Pure logic in `supabase/functions/_shared/translate.ts` (request builders, response parsing, cleanup, fallback, cap stop). Prices added to `prices.ts` as unverified (per character). Web: `lib/foods.js` (search matches English, Spanish and brand; `displayName`; `saveFoodNames`; `saveUsdaFoodAndTranslate`), Foods page edit form, `foods` locale keys in en and es.
- 2026-10-17: Tests: `npm run lint` passed; `npm run build` passed; `npm test` 356 passing in 29 files (includes the new `spanishNames.test.js` for the translation logic with fetch and gate mocked, and new cases in `foods.test.js` and `FoodsPage.test.jsx`); `npm run format:check` passed. NOT RUN: `supabase/tests/spanish_food_names_test.sql` (21 pgTAP checks, needs `supabase test db` on a local stack, ticket 69); the Edge Function was not run or deployed (no Deno, no Supabase CLI); the backfill was not run. Ticket 15's live 20-name test is still pending a key. Boxes 1, 2 and 4 stay unticked: each depends on the database write path or the function, which were not run.
- 2026-10-17: To finish, the user must: (1) create a Google Cloud Translation key and set it with `supabase secrets set GOOGLE_TRANSLATE_KEY=...` (optional Azure: `AZURE_TRANSLATOR_KEY` and `AZURE_TRANSLATOR_REGION`); (2) apply migration 017 and run `supabase test db` locally (ticket 69); (3) deploy the function with `supabase functions deploy translate-food-name` only after review; (4) run the backfill once per Household with `curl -X POST "$SUPABASE_URL/functions/v1/translate-food-name" -H "Authorization: Bearer <member session token>" -H "Content-Type: application/json" -d '{"backfill":true,"limit":25}'` and repeat until `remaining` is 0. Not measured: Google's free-tier size and price, and the translation quality on food names (ticket 15's test is still pending).
- 2026-10-18: `supabase db reset` (001–033) and `supabase test db` run on the local stack: 22 files, 387 tests, all pass.
