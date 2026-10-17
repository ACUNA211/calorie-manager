# 86: Set a real USDA API key

**Type:** your task (not for an agent)

**What to do:** The USDA lookups (search, save, barcode) read the key from Supabase Vault as `usda_api_key` and fall back to `DEMO_KEY`, which allows only 30 requests an hour shared by every Member. Now that the app calls them for every signed-in Member (migration 024), get a free key at https://fdc.nal.usda.gov/api-key-signup and set it yourself in the Supabase SQL editor (never in a file):

`select vault.update_secret((select id from vault.secrets where name = 'usda_api_key'), '<your key>');`

(If the secret doesn't exist yet, migration 004 creates it; run `supabase db push` first.)

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

**Unblocks:** 14, 18

- [ ] Key set in Vault
- [ ] A Foods search returns USDA results without a rate-limit error
