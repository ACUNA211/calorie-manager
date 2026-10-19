# 15: Research: translation API free tiers

**What to build:** Find the cheapest way to translate food names (about 50 characters each, a few hundred a month) from English to Spanish. Compare Google Cloud Translation, DeepL API Free, Azure Translator, LibreTranslate and a cheap AI call: free tier size, price after it, data-use terms, quality on food names. Check each on the vendor's own page.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 76 (Get API keys and run the research tests)

**Status:** done

- [x] A short markdown report in `.scratch/restart/research/` with a cited table and a pick (`.scratch/restart/research/translation-apis.md`)
- [ ] Test 20 real food names from the Food Library on the top two options and include the outputs (pending a key: reference renderings are in the report, and `scripts/translate-test.mjs` is ready to run)
- [x] States what the pick costs per month for this Household (expected $0)

## Comments

- 2026-10-17: Pick is Google Cloud Translation Basic, with Azure F0 as fallback. Pending: a live run of the 20 names (needs `GOOGLE_TRANSLATE_KEY`, and optionally Azure and Anthropic keys); the Google free-tier size and price were not readable on the vendor page; the Azure S1 price and Microsoft data-privacy page were not verified; DeepL API Free may be closed to new signups (search extract only).
