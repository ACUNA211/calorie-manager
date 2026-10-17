# Translation APIs for Food Library names (ticket #15)

Date: 2026-10-17. Question: the cheapest way to fill the Spanish name of a food (about 50 characters, a few hundred a month) under ADR 0002 and CONTEXT.md ("filled once by a translation API's free tier, a cheap AI call if none fits").

Volume used for the cost: 300 names a month x 50 characters = about 15,000 characters a month. Every free tier below is at least 100x that.

## Verification key

- **Verified**: read on the vendor's own page this session.
- **Search extract**: a search-engine snippet or secondary page, not read in full. Treat as unconfirmed.
- **Not verified**: could not be read (blocked, truncated or 404). Needs a check.

## Cited table

| Option | Free tier (size) | Price after free tier | Data-use and retention terms | Source (status) |
|---|---|---|---|---|
| **Google Cloud Translation (Basic v2/v3)** | Not on the fetched page (page truncated). Commonly cited as 500,000 characters a month. | Not on the fetched page. Commonly cited as about $20 per million characters. | Verified: "No customer data or translations are used to improve Cloud Translation API models." Text "is held briefly in-memory in order to perform the translation". "Google does not use the content you send to train and improve our Google Translation features." Retention period not stated. | https://docs.cloud.google.com/translate/data-usage (verified; cloud.google.com redirects here). https://docs.cloud.google.com/translate/docs/intro-to-v3 (verified, the "not used to improve" line). Pricing: https://cloud.google.com/translate/pricing (**not verified**, page truncated). |
| **DeepL API Free** | Search extract: 500,000 characters a month. Support page says the API Free plan "can no longer be purchased" (search extract). The 50,000 figure on the public page is for the web translator, not the API. | Search extract only, conflicting: about $5.49 a month plus $25 per million characters (third-party). The official plans page was not readable. | Verified for Pro only: content "never used to train DeepL's AI models"; the Free plan is not addressed. | https://www.deepl.com/pro-api (verified: 50,000 for the web Free translator; no API figures). https://www.deepl.com/en/pro#developer (verified, Pro-only training line). https://support.deepl.com/hc/en-us/articles/360021200939-DeepL-API-plans (**search extract**, page returned 403). |
| **Azure AI Translator** | **Verified**: F0 gives "2 million characters of any combination of standard translation and custom translation training free per month." | S1 rate shown only as a placeholder on the page ("$- per million characters"). Third-party: about $10 per million characters (**not verified**). One guide says the free tier is first-year-only; this conflicts with the official page. | **Not verified.** The Microsoft data-privacy page returned 404. | https://azure.microsoft.com/en-us/pricing/details/translator/ (verified for F0; S1 not shown). |
| **LibreTranslate (hosted)** | None. The portal says free keys are not offered: "it's just not sustainable for us". Pro $29 a month, Business $58 a month. | $29 a month (Pro), 80 translations a minute burst, about 1,200 an hour sustained. Business $58 a month, 200 a minute burst. Each call up to 2,000 characters. | Not found on the page. | https://portal.libretranslate.com/ (verified). https://libretranslate.com/ (verified: AGPLv3, "Free to download", no price). Self-hosting is free under AGPLv3 but needs a server, which the Household does not have. |
| **Claude Haiku 5.5 (cheap AI call)** | None found on the pricing page (not checked further). | **Verified**: $0.10 per million input tokens, $0.50 per million output tokens; Batch 50% off; cache reads $0.01. | Verified (retention only): inputs and outputs are deleted "within 30 days of receipt or generation" by default. Model training not stated on that page. | https://platform.claude.com/docs/en/about-claude/pricing (verified). https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data (verified, retention). |

Also checked and not used: Gemini (costs.md, primary-verified) has a free tier that uses submitted content "to improve our products" (per costs.md, from the 09-30 check), which rules it out for household data.

## Cost per month for this Household

| Option | Monthly characters | Cost |
|---|---|---|
| Google Cloud Translation, Basic | about 15,000 | **$0** (inside the free tier, if the commonly cited 500,000 is right) |
| Azure F0 | about 15,000 | **$0** (inside the verified 2 million) |
| Claude Haiku 5.5 as fallback | about 300 calls x ~165 tokens | under **$0.01** (about $0.007: 150 in x $0.10/M plus 15 out x $0.50/M per name) |

Even with no free tier at all, Google at about $20 per million characters would cost about **$0.30 a month**. The expected cost is **$0 a month**.

## Pick

**Google Cloud Translation, Basic (v2 REST).** Reasons:

1. Its data-use terms are the clearest of the vendors read in full: no training on content, and in-memory handling. That is what a shared household database needs.
2. Its free tier at this volume is almost certainly zero cost, but the exact figure is not confirmed on the vendor page, so that is the first thing to check.
3. Azure F0 is the fallback if Google's billing setup is refused. It has the verified free size, but its data-use terms are not confirmed.

DeepL is not picked: its free API tier is reported as closed to new signups and its Free-plan data terms are not stated. LibreTranslate has no free hosted tier. Haiku is the last fallback in the ADR.

Quality on food names is not yet tested. Some phrasing (for example "Plátano" versus "Banana", or "Papa" versus "Patata") depends on the Household's regional Spanish, so the live test below decides.

## Spanish reference renderings (our own)

These are the reference for comparing vendors. They were written by hand for Latin American Spanish, the Household's variety. Vendor output is still **pending a key**.

| # | English (USDA-style name) | Reference (ours) |
|---|---|---|
| 1 | Chicken breast, roasted | Pechuga de pollo asada |
| 2 | Greek yogurt, plain, nonfat | Yogur griego natural sin grasa |
| 3 | Brown rice, cooked | Arroz integral cocido |
| 4 | Egg, whole, raw | Huevo entero crudo |
| 5 | Oatmeal, cooked | Avena cocida |
| 6 | Bananas, raw | Plátano crudo |
| 7 | Black beans, cooked | Frijoles negros cocidos |
| 8 | Broccoli, cooked, boiled | Brócoli cocido, hervido |
| 9 | Olive oil | Aceite de oliva |
| 10 | Cheddar cheese | Queso cheddar |
| 11 | Whole wheat bread | Pan integral |
| 12 | Salmon, Atlantic, farmed, cooked | Salmón atlántico de cultivo, cocido |
| 13 | Potato, baked, flesh and skin | Papa al horno, con piel |
| 14 | Ground beef, 90% lean, cooked | Carne molida de res, 90% magra, cocida |
| 15 | Tortilla, corn | Tortilla de maíz |
| 16 | Apple, raw, with skin | Manzana cruda, con cáscara |
| 17 | Milk, whole | Leche entera |
| 18 | Peanut butter, smooth | Mantequilla de maní cremosa |
| 19 | Spinach, raw | Espinaca cruda |
| 20 | Lentils, cooked | Lentejas cocidas |

## Live test: pending a key

- No vendor offers a public keyless endpoint that was usable: Google, Azure and DeepL need keys, and LibreTranslate's public endpoint now needs a key too. No keys were used and no accounts were created.
- Script saved: `scripts/translate-test.mjs` in this worktree. It reads `GOOGLE_TRANSLATE_KEY`, `AZURE_TRANSLATOR_KEY` with `AZURE_TRANSLATOR_REGION`, and `ANTHROPIC_API_KEY` from the environment. Vendors without a key are skipped. It was syntax-checked and runs with no keys (it prints the reference table).
- Run: `node scripts/translate-test.mjs > .scratch/restart/research/translation-test-output.md`

## Still to check (before the pick is final)

1. Google: the free-tier size and per-million price on https://cloud.google.com/translate/pricing (the fetch was truncated).
2. Azure: the S1 per-million price in the calculator, and the data-privacy statement (the Microsoft page returned 404).
3. DeepL: whether API Free can still be created, and its Free-plan data terms.
4. The live test of the 20 names on Google and Azure with a key, compared with the reference above.
