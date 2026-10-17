# 83: Deploy the Edge Functions and set their secrets

**Type:** your task (not for an agent)

**What to do:** Ticket 16 added the `translate-food-name` Edge Function. It needs your key as a Supabase secret, a deploy, and a one-time backfill. Keys go in Supabase secrets only, never in a file.

1. After 76 gives you a Google Cloud Translation key, from the repo root run `supabase secrets set GOOGLE_TRANSLATE_KEY=<your key>` (optional fallback: `supabase secrets set AZURE_TRANSLATOR_KEY=<key> AZURE_TRANSLATOR_REGION=<region>`).
2. After the database tests pass (69), push the migrations (`supabase db push`), then run `supabase functions deploy translate-food-name`.
3. Signed in to the app, save one USDA food on the Foods page and check that it gets a Spanish name.
4. Backfill existing foods once per Household: call the function with body `{"backfill": true, "limit": 25}` (signed in as a Member), and repeat until it returns `remaining: 0`.

Ticket 30 added the `parse-recipe` Edge Function (Paste a Recipe, Anthropic `claude-haiku-5-5`):

5. Create the Anthropic key yourself (76 lists it), then run `supabase secrets set ANTHROPIC_API_KEY=<your key>`.
6. Optional local check: install Deno, run `deno check supabase/functions/parse-recipe/index.ts`.
7. Run `supabase functions deploy parse-recipe`, then paste a real recipe in the app and check the review screen, the matches and the AI cap message.

**Blocked by:** 69 (Run the database tests locally), 76 (Get API keys and run the research tests)

**Status:** ready-for-human

**Unblocks:** 16, 30

- [ ] Secret set and function deployed
- [ ] A newly saved food gets a Spanish name
- [ ] Backfill returned `remaining: 0`
- [ ] `parse-recipe` deployed; a pasted recipe reaches the review screen
