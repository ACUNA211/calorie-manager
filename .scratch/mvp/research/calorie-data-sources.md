# Where do calorie counts come from?

Research for [issues/02-calorie-data-sources.md](../issues/02-calorie-data-sources.md). Sources checked 2026-09-27. Every claim cites the page it came from; "unverified" means I couldn't confirm it on a primary source.

## The question

When a Member logs food that isn't in the Food Library, the Agent must find it and estimate calories. Scale: one Household, two Members, perhaps a few dozen lookups a day. Macros are out of scope, so only calories matter.

## Comparison

| Source | Generic foods | Branded / restaurant | Free text ("2 eggs and toast") | Price for 2 users | Licence / caching | Auth and limits |
|---|---|---|---|---|---|---|
| **USDA FoodData Central** | Strong: Foundation, SR Legacy, FNDDS | Branded: US label data, updated monthly. Restaurant: some fast-food items in SR Legacy/FNDDS, frozen since 2018 | No. Keyword search only, no quantity parsing | Free | Public domain (CC0). Store freely; citation requested | API key via api.data.gov; 1,000 req/hour/IP |
| **Open Food Facts** | Weak (it's a packaged-product DB) | Packaged, crowd-sourced, worldwide; no restaurants | No. Search is rate-limited and full-text is moving to Search-a-licious | Free | ODbL + share-alike; attribution with link required | No key; User-Agent required; 15 product reads and 10 searches per min per IP |
| **Nutritionix** | Strong (curated from USDA plus international) | Largest: 1M+ grocery, 203K restaurant items | Yes: `/v2/natural/nutrients` | Public free tier **discontinued**; $499/month and up | Attribution required on cheaper plans; caching only on higher plans | App ID + key |
| **FatSecret Platform** | Strong | Strong, verified; 62+ countries on Premier | Yes, via NLP endpoint, but it's a **Premier-only paid add-on** | Basic: free, 5,000 calls/day, US data. Premier Free: free for startups under $1M | Attribution required on free tiers; **may not cache data for more than 24h** except IDs | OAuth 2.0; tokens only from allow-listed server IPs |
| **Edamam** | Good (~900K foods total) | 130K restaurant items, 790K UPCs | Yes: parser takes quantities; Nutrition Analysis takes ingredient lines | No free tier found; from $14/month (30-day trial) | Required attribution (image + link); caching of calories only on eligible paid plans | app_id + app_key |
| **LLM estimate only** | Good for common foods | Guesses; not grounded in real labels | Best at understanding what the Member meant | Pennies at this scale (token cost) | Nothing to license; you own the output | Whatever AI provider the stack uses |

## Per-source notes

### USDA FoodData Central (FDC)

- Data types: Foundation, SR Legacy, Survey (FNDDS), Experimental and Branded Foods, all searchable through `/foods/search`, which can be filtered by data type. [FDC API guide](https://fdc.nal.usda.gov/api-guide/)
- Limits: a normal key allows 1,000 requests per hour per IP, with a 1-hour block if you go over. `DEMO_KEY` allows 30 per hour and 50 per day. A key must go in every request and must not be made public. [FDC API guide](https://fdc.nal.usda.gov/api-guide/)
- Licence: public domain under CC0 1.0. FDC asks you to name "FoodData Central" as the source. [FDC API guide](https://fdc.nal.usda.gov/api-guide/). So we can copy results into the Food Library and keep them forever.
- Freshness: Foundation is updated twice a year. SR Legacy's final release was April 2018. FNDDS is updated every two years. Branded is monthly and comes from manufacturers' label data. [FDC data documentation](https://fdc.nal.usda.gov/data-documentation/)
- Restaurant coverage (my test, 2026-09-27): searching "big mac" returned SR Legacy "McDONALD'S, BIG MAC" (Fast Foods category, 257 kcal/100 g) and FNDDS "Big Mac (McDonalds)". So some chain items exist, but SR Legacy is frozen at 2018, so menus will be out of date.
- Free text (my test): searching "2 eggs and a slice of toast" returned 197,934 hits, led by "Bread, egg, toasted". It's keyword matching. It doesn't split out items or understand quantities. Values are per 100 g, plus portion weights for some foods, so something has to turn "2 eggs" into grams.
- Accuracy: Foundation data comes from USDA's own lab analysis [FDC data documentation](https://fdc.nal.usda.gov/data-documentation/), which makes it the most authoritative source for generic foods.

### Open Food Facts (OFF)

- Rate limits: 15 req/min/IP for product reads, 10 req/min/IP for searches, and the docs warn: "don't use it for a search-as-you-type feature, you would be blocked very quickly". [OFF API docs](https://openfoodfacts.github.io/openfoodfacts-server/api/) *Changed:* I remember older docs giving 100 product reads per minute. The current page says 15.
- Auth: reading needs no key, just a User-Agent of the form `AppName/Version (ContactEmail)`. [OFF API docs](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- Search: full-text search is not in API v2. It "will be available in Search-a-licious". [OFF API docs](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- Licence: ODbL for the database, DbCL for its contents, CC BY-SA for images. Reusers must credit Open Food Facts with a link, and derivative databases must be shared under the same terms. [OFF terms of use](https://world.openfoodfacts.org/terms-of-use) Keeping OFF-derived rows in our Food Library could make the library a "derivative database" under the share-alike rule. That's manageable for a private two-person app, but it's worth knowing.
- Accuracy: contributed voluntarily, with no guarantee of accuracy. [OFF API docs](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- Fit: it shines with barcodes, which are out of scope. Weak for generic and restaurant food.

### Nutritionix

- Coverage: "over 1M grocery foods with barcodes and 203K restaurant foods". Common foods start from USDA data and are curated by registered dietitians. It also has a natural-language engine. [Nutritionix API page](https://www.nutritionix.com/api)
- Pricing (listed): "FREE Business Trial" for up to 2 MAU, Starter $499/month, MVP from $1,850/month, billed annually. Attribution is required below the top tier. "Caching Allowed" appears as a feature row, but the page's table layout didn't come through, so I couldn't confirm which tiers include it. [Nutritionix API page](https://www.nutritionix.com/api)
- **Recent change:** "the public free-access tier has been discontinued" [developer portal](https://developer.nutritionix.com/admin/access_details). "We no longer offer open, public access for personal, non-commercial, or student use". Trials are only for "qualified commercial, research, and enterprise evaluations". [Request API Trial](https://www.nutritionix.com/request-api-trial) The site footer now says "© 2026 Syndigo LLC". [Nutritionix API page](https://www.nutritionix.com/api) I couldn't confirm when Syndigo bought it.
- Endpoint: `POST https://trackapi.nutritionix.com/v2/natural/nutrients` with `{"query": "..."}`. This comes from secondary sources, because the docs pages returned HTTP 402 to automated fetches.
- Fit: the best product for exactly this use, but a household app can't get into it at a sensible price. **Ruled out.**

### FatSecret Platform API

- Editions: **Basic** is free with 5,000 calls/day, US data only, and attribution required. **Premier Free** is for startups under $1M revenue or funding, non-profits and students: unlimited calls, US data, attribution required. **Premier** costs "upon request", priced per country (62+ countries, 26 languages). NLP and image recognition are "Optional Add-On" features for Premier Free and Premier, billed by usage. [FatSecret API editions](https://platform.fatsecret.com/api-editions)
- NLP: `POST /rest/natural-language-processing/v1`, `user_input` up to 1,000 characters, can contain several items, marked "Premier Exclusive", needs the `nlp` scope. [FatSecret NLP docs](https://platform.fatsecret.com/docs/v1/natural.language.processing)
- Search: `foods.search` / `foods.autocomplete` with fuzzy matching and synonyms. [foods.search](https://platform.fatsecret.com/docs/v3/foods.search)
- **Caching:** "you may not cache any user data for more than 24 hours". Only IDs (food_id, serving_id and similar) "are storable indefinitely; all other information must be requested from fatsecret each time." [Storable data](https://platform.fatsecret.com/docs/guides/storable-data) The editions page also lists "Caching" as included in every edition [editions](https://platform.fatsecret.com/api-editions). These two pages seem to conflict. I read the storable-data page as the binding rule. That clashes with copying calories into our own Food Library.
- Auth: OAuth 2.0 client credentials, with tokens valid for 86,400 s. Tokens "can only be requested from a finite number of IP addresses" that you register, so serverless hosting with changing IPs needs a static-egress proxy. [FatSecret OAuth 2.0](https://platform.fatsecret.com/docs/guides/authentication/oauth2)
- Fit: the free Basic tier is generous enough, but the IP allow-list, the 24-hour caching rule and the paid-only NLP make it awkward.

### Edamam (Food Database / Nutrition Analysis)

- Food Database plans: Enterprise Basic $14/month (30-day trial, 100K calls/month), Core $69/month, Plus $299/month, Unlimited custom. "Close to 900,000" foods, 790K UPCs and 130K restaurant items. It has its own natural-language engine. [Edamam Food DB](https://developer.edamam.com/food-database-api) I found no free developer tier on the current pricing page. *Changed:* older Edamam plans had a free developer tier. It's no longer listed.
- Attribution: every plan must show the Edamam badge image linking to developer.edamam.com. Not complying leads to "immediate service suspension". [Edamam Food DB](https://developer.edamam.com/food-database-api)
- Caching: only "protein, total fat, net carbs and calories as well as the foodId, food label and food image", only on eligible paid plans, and only for password-protected end-user accounts. [Edamam Food DB](https://developer.edamam.com/food-database-api) That's actually fine for us, since we only need calories.
- Parser: `/api/food-database/v2/parser?ingr=...` understands quantity and measure (for example "1 whole chicken"). [Edamam Food DB docs](https://developer.edamam.com/food-database-api-docs) The Nutrition Analysis API pulls food, measure and quantity out of unstructured text, and charges a licensing fee for each newly analysed ingredient line or recipe. [Edamam Nutrition Analysis docs](https://developer.edamam.com/edamam-docs-nutrition-api) I couldn't find published per-minute rate limits.

### LLM estimation from free text

- NutriBench (ICLR 2025): 11,857 meal descriptions built from real dietary-intake data. Twelve LLMs, including GPT-4o, gave carbohydrate estimates "comparable but significantly faster" than professional nutritionists. [arXiv 2407.12843](https://arxiv.org/abs/2407.12843) Secondary coverage says GPT-4o got 66.8% of estimates within ±7.5 g of carbohydrates. That figure isn't in the abstract, so it's unverified. The benchmark measured carbohydrates, not calories.
- Estimating calories for ready-meal boxes against their labels (2025): dietitians came out at 99.5% of the labelled value. The LLMs ranged from 71.4% (ChatGPT) to 126.8% (Grok), with Claude 3.7 at 117.0%, so models both under- and over-estimated by 10 to 30%. [PMC12526241](https://pmc.ncbi.nlm.nih.gov/articles/PMC12526241/)
- Takeaway: LLMs are very good at understanding the text (splitting "2 eggs and a slice of toast" into items and quantities, and guessing portion weights). Their calorie numbers on their own are biased and vary from model to model. Grounding each item against a database fixes the per-gram energy density. The remaining error is mostly in portion size, which no API can know either.

## Recommendation

**Primary: USDA FoodData Central, reached through the Agent, with the LLM doing the parsing.**
- Free, public domain, so we can save every result into the Food Library permanently, and 1,000 req/hour is far more than we need.
- It's the most authoritative source for generic foods, and it covers US packaged foods (Branded) plus some fast-food items.
- Its gap (no understanding of free text) is exactly what the LLM we already run for the Agent is good at.

**Fallback: an LLM-only estimate, clearly marked as an estimate.** Use it when FDC has no confident match (restaurant dishes, home cooking, non-US products). It costs nothing extra, and the Member can edit it before saving.

**Optional later upgrade:** FatSecret Basic (free, 5,000/day) as a second database for branded and restaurant foods, *if* FDC's restaurant gaps hurt in practice. First check the IP allow-list against the hosting choice, and accept the 24-hour caching rule (store only `food_id` in the Food Library and fetch again when needed). Open Food Facts is only worth adding if barcode scanning comes back into scope. Nutritionix (≥$499/month, no public free tier) and Edamam (paid, badge required) aren't worth it for two users.

### How the Agent combines them

1. **Parse** (LLM, structured output): free text → `[{name, quantity, unit, estimated_grams, llm_kcal_guess}]`. "2 eggs and a slice of toast" → egg ×2 (~100 g), toast ×1 slice (~30 g).
2. **Check the Food Library first.** A hit uses the stored kcal per 100 g.
3. **Look up** each miss in FDC `/foods/search` (prefer Foundation/SR Legacy/FNDDS for generic foods, Branded when a brand is named). The LLM picks the best of the top ~5 candidates, or says "no good match".
4. **Compute** kcal = FDC kcal/100 g × estimated grams, using FDC portion weights when they exist.
5. **Sanity-check**: if the database result and `llm_kcal_guess` differ by more than ~40%, show both and let the Member choose.
6. **Fall back** to the LLM guess (marked "estimated") when there's no match.
7. **Save** the confirmed item to the Food Library with its source (`fdc:<fdcId>`, `llm`, or `member`), so next time is instant and consistent. Credit FDC on an About screen.

## Couldn't verify

- Nutritionix docs pages returned HTTP 402 to automated fetches. The pricing text comes from the raw HTML of the public API page. Which tiers allow caching, and the exact endpoint docs, are unconfirmed.
- When Syndigo acquired Nutritionix.
- Edamam's per-minute rate limits, and whether any free developer tier still exists somewhere other than the pricing page.
- FatSecret's pricing for the NLP add-on, and whether a Basic-tier app qualifies for it.
- The NutriBench accuracy figures beyond what the abstract says.
