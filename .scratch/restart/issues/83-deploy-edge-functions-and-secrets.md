# 83: Deploy the Edge Functions and set their secrets

**Type:** your task (not for an agent)

**What to do:** Ticket 16 added the `translate-food-name` Edge Function. It needs your key as a Supabase secret, a deploy, and a one-time backfill. Keys go in Supabase secrets only, never in a file.

1. After 76 gives you a Google Cloud Translation key, from the repo root run `supabase secrets set GOOGLE_TRANSLATE_KEY=<your key>` (optional fallback: `supabase secrets set AZURE_TRANSLATOR_KEY=<key> AZURE_TRANSLATOR_REGION=<region>`).
2. After the database tests pass (69), push the migrations (`supabase db push`), then run `supabase functions deploy translate-food-name`.
3. Signed in to the app, save one USDA food on the Foods page and check that it gets a Spanish name.
4. Backfill existing foods once per Household: call the function with body `{"backfill": true, "limit": 25}` (signed in as a Member), and repeat until it returns `remaining: 0`.

**Blocked by:** 69 (Run the database tests locally), 76 (Get API keys and run the research tests)

**Status:** ready-for-human

**Unblocks:** 16

- [ ] Secret set and function deployed
- [ ] A newly saved food gets a Spanish name
- [ ] Backfill returned `remaining: 0`
