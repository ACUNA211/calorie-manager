# Recipe Databases and Datasets for a Household Meal-Planning / Calorie-Tracking App (as of Oct 2026)

Method note: the session's network proxy blocked direct fetches of spoonacular.com, developer.edamam.com, themealdb.com and huggingface.co (connect rejected / DNS failure). Facts about those sites come from search-engine snippets of the official pages, plus third-party mirrors where marked. Search snippets can be stale (one snippet said the cached Spoonacular terms page was about 2,481 days old). Anything not confirmed on a primary page is marked **(unverified)**. Check every price and term against the live page before committing.

## Spoonacular API: plans, points, free tier, caching, nutrition

### Takeaway
Spoonacular is free at 50 points a day, then $29, $79 or $149 a month. Its terms let you cache data for at most 1 hour, and only with written permission. Only recipe ID, title and image URL may be stored permanently. That rules it out as a permanent recipe library, though it could serve as a live lookup or inspiration source.

### Cited Findings
- Official pricing (per search snippet of the official page): Free = 50 points/day, no more calls after that; Cook $29/mo = 1,500 points/day; Culinarian $79/mo = 4,500 points/day; Chef $149/mo = 10,000 points/day; Enterprise custom (around $300+, unverified). Paid tiers charge $0.002–$0.005 per point over the allotment — [spoonacular pricing](https://spoonacular.com/food-api/pricing)
- Point model: usually 1 point per request plus 0.01 points per result returned, with surcharges for nutrition, ingredient filling, image widgets and video extraction (June 2026 comparison article; secondary) — [foodashi.com](https://foodashi.com/blog/best-recipe-apis-for-developers/); [spoonacular pricing](https://spoonacular.com/food-api/pricing)
- Conflicting free-tier figures: some third parties say 150 points/day or 150 requests/day. These look out of date — [calorieapi.com](https://calorieapi.com/blog/spoonacular-api-pricing). APILayer's marketplace lists a separate 3,000 requests/month tier — [APILayer](https://marketplace.apilayer.com/spoonacular-api). An older PyPI client page said a credit card was required even for the free plan (unverified for 2026) — [pypi spoonacular](https://pypi.org/project/spoonacular)
- Caching: "with prior written permission from spoonacular, you may cache user-requested data to improve performance (for a maximum of 1 hour)", after which the cache must be cleared. Recipe IDs, titles and image URLs may be stored indefinitely, but not "other data… including but not limited to ingredients, instructions, nutritional information" — [spoonacular terms](https://spoonacular.com/food-api/terms) (the snippet showed an old cached copy, so confirm the current wording)
- The terms also reportedly forbid storing derived or transformed data (secondary) — [devzery guide](https://www.devzery.com/post/spoonacular-api-complete-guide-recipe-nutrition-food-integration)
- Attribution/backlink: a third-party listing says the terms require attribution back; exact requirement unverified — [freeapihub](https://freeapihub.com/apis/spoonacular-api)
- Recipe count is unclear: about 5,000 by one source versus 365,000+ by APILayer (both third-party; unverified) — [freeapihub](https://freeapihub.com/apis/spoonacular-api); [APILayer](https://marketplace.apilayer.com/spoonacular-api)
- Developers build hourly shared caches specifically to stay within the 1-hour rule and limit point spend — [LazyChef PR #7](https://github.com/qujo1028/LazyChef/pull/7)

### Inferences
- With 50 points/day, about 10–30 rich searches with nutrition a day might fit (rough estimate; surcharge sizes unverified). That is enough for one household's weekly plan but leaves no room to grow.
- Because nutrition can't be stored, every logged meal would either need a fresh API call or a recompute from FDC. Calorie logs must persist, so Spoonacular nutrition can't be the system of record.
- Spoonacular has filter parameters for diet, cuisine and max ready time (complexSearch), and they fit the AI planner well. However, I could not confirm the parameters from the docs in this session (see Gaps).

### Gaps
- I could not load the live pricing or terms pages, so the exact 2026 surcharge per nutrition result, the free-plan backlink rule and whether a credit card is needed are unconfirmed.
- I could not confirm the complexSearch filter parameters (diet, intolerances, cuisine, maxReadyTime) or the per-serving nutrition fields from the docs in this session.

## Edamam Recipe Search API: plans, prices, limits, storage, nutrition

### Takeaway
Recipe Search is a paid product only: $9, $99 or $399 a month, or custom. Caching is limited to recipe URI, title, image and four macros (calories, protein, fat, net carbs). Attribution ("Powered by Edamam") is mandatory, and data must be deleted when you cancel. Plans below $399 return web recipes without instructions, only links to the source sites.

### Cited Findings
- The official page lists Recipe Search tiers at $9, $99 and $399 per month plus Custom — [Edamam Recipe Search API](https://developer.edamam.com/edamam-recipe-api)
- Plan detail from a third-party YAML mirror. Its own header says it is generated and unverified: Basic $9 (10-day trial) = 10,000 calls/mo at 10/min, web recipes, macro-only caching; Core $99 = 500,000 calls/mo at 100/min; Plus $399 = 1,000,000 calls/mo at 300/min, Edamam-owned recipes with instructions plus CO2e; Unlimited custom — [api-evangelist mirror](https://github.com/api-evangelist/edamam-recipes/blob/main/plans/edamam-recipes-plans-pricing.yml)
- The same mirror lists: a Nutrition Analysis Developer plan at $0, about 10,000 calls/mo, non-commercial only; a Meal Planner API Developer plan at $0 for 10 MAU, non-commercial, no caching, with Enterprise Core at $300/mo; and a Food Database API from $14/mo — [api-evangelist mirror](https://github.com/api-evangelist/edamam-recipes/blob/main/plans/edamam-recipes-plans-pricing.yml)
- Full cooking instructions only on Plus ($399) and up (third-party) — [ymove.app](https://ymove.app/recipe-api/top-recipe-apis); for web-sourced recipes "no cooking instructions are provided" and attribution to the content owner is required — [Edamam Recipe Search API](https://developer.edamam.com/edamam-recipe-api)
- An older retired Recipe Search page showed $99, $249 and $999 tiers, so third-party price quotes vary — [Edamam retired recipe-api](https://developer.edamam.com/recipe-api)
- Caching: not permitted unless Edamam explicitly allows it. Where allowed, it covers only the recipe URI, title, image and four macros (protein, total fat, net carbs, calories). Saved data may be shown only in the end user's password-protected account and may not be used to build a search or a copy of the database — [Edamam Recipe Search API](https://developer.edamam.com/edamam-recipe-api); [Edamam Nutrition Analysis API](https://developer.edamam.com/edamam-nutrition-api)
- Terms prohibit "automated programatic requests with the goal to collect, scrape or save data" — [Edamam Recipe Search API](https://developer.edamam.com/edamam-recipe-api)
- Attribution: "powered by" plus the Edamam logo linking to developer.edamam.com. Omitting it is a breach of contract and leads to immediate suspension — [Edamam FAQ](https://developer.edamam.com/api/faq); [Edamam Diet API (retired)](https://developer.edamam.com/edamam-diet-api)
- On cancellation you must return or delete all nutrition data and can no longer use it — [Edamam FAQ](https://developer.edamam.com/api/faq)
- Size: the marketing page title claims "2 Million Recipes" — [Edamam Recipe Search API](https://developer.edamam.com/edamam-recipe-api)

### Inferences
- $9/mo (10k calls) easily covers one household. However, cancelling forces you to delete stored macros, so the calorie history would have to be re-based on FDC anyway.
- Edamam's diet and health labels and its cuisine and meal-type filters suit the AI planner. Without instructions below $399, though, users would click out to the source sites.

### Gaps
- Exact 2026 per-tier call limits and throttles could not be confirmed from the primary page. The mirror's figures are unverified.
- Whether ingredient lines include parsed gram weights in the 2026 response was not confirmed. Historically the response included an `ingredients[].weight` field, but that is unverified here.

## TheMealDB (and TheCocktailDB-style free APIs)

### Takeaway
TheMealDB is tiny (about 600–670 meals) and cheap (a one-time ~$10/£10 supporter key). It has no nutrition data and only free-text measures, and the free key may not be used in published apps. It isn't enough as a primary source but is acceptable as a small seed set if you buy the supporter key.

### Cited Findings
- About 669 meals and 927 ingredients per one aggregator; another snapshot shows 598 — [jentic](https://jentic.com/apis/themealdb.com/themealdb); [apievangelist providers](https://providers.apievangelist.com/providers/themealdb/)
- Premium is a one-time lifetime upgrade, quoted as $10 or £10. Premium-only endpoints include random selection and latest meals — [apievangelist store](https://apis.apievangelist.com/store/mealdb-premium-api/); [apis.io rate limits](https://apis.io/rate-limits/mealdb/mealdb-rate-limits/)
- No published per-second or per-month quotas — [apis.io rate limits](https://apis.io/rate-limits/mealdb/mealdb-rate-limits/)
- ToS excerpt: the free key is for development only and "cannot publish apps to an appstore unless you are a paid subscriber". Paid supporters may build apps and services within the rate limit (third-party ToS tracker; unverified on the official site) — [tostracker](https://tostracker.app/document/themealdbcom-tos)

### Inferences
- No nutrition fields, and measures are strings such as "1 cup". Every recipe would need ingredient-to-FDC matching plus unit-to-gram conversion.
- Many meals are UK or international, so US English coverage is thin.

### Gaps
- The official api.php page and licence text could not be fetched. The licence for storing data permanently is unconfirmed.

## Tasty / BBC Good Food / Allrecipes "unofficial APIs"

### Takeaway
None of these sites offers a sanctioned public recipe API. The "APIs" on offer are scrapers, from Apify actors and the tastyR package, that hit private backends or bot-protected pages. Using them commercially is legally risky and can break without notice, so avoid them.

### Cited Findings
- An Apify Tasty scraper describes using "Tasty's official backend API". That is a third-party tool, not a public API — [Apify Tasty scraper](https://apify.com/shahidirfan/tasty-recipes-scraper)
- Allrecipes uses Akamai Bot Manager, which blocks datacenter and residential IPs, and "doesn't provide a good and free API" (scraper vendor's statement) — [Apify Allrecipes scraper](https://apify.com/parseforge/allrecipes-scraper?fpr=vmoqkp)
- The tastyR R package of scraped Allrecipes data is labelled CC0. That is the maintainer's label and grants no rights to Allrecipes content — [tastyR](https://r-packages.io/packages/tastyR)
- Copyright principle (UK guidance, not US law): a recipe's expressive text can be protected, while following a recipe isn't infringement; copying verbatim needs permission — [britishcopyright.org](https://britishcopyright.org/information/recipes)

### Inferences
- In the US, ingredient lists are generally treated as facts, while instructions and headnotes are expressive. That distinction is my understanding, not sourced here. An app could store user-pasted recipes for personal use, but bulk scraping into a shared library breaches site ToS regardless of copyright.

### Gaps
- I did not retrieve the actual ToS text of Allrecipes, Tasty/BuzzFeed or BBC Good Food in this session, so the anti-scraping clauses are unverified.

## Open datasets: RecipeNLG, Food.com, Recipe1M+, Epicurious, Open Recipes, Wikibooks Cookbook

### Takeaway
The big datasets are research-only or have murky licences: RecipeNLG and Recipe1M+ are explicitly non-commercial, and Food.com is a scraped dataset with no clear licence. The Wikibooks Cookbook is CC BY-SA (commercial use allowed with attribution and share-alike) but small and unstructured. None has gram-structured ingredients, and only the Food.com-derived sets carry nutrition.

### Cited Findings
- **RecipeNLG**: 2,231,142 recipes, of which about 1.6M were gathered by the authors and the rest come from other datasets — [RecipeNLG GitHub](https://github.com/Glorf/recipenlg). Access terms require use "only for non-commercial research and educational purposes" — [HF dataset card](https://huggingface.co/datasets/mbien/recipe_nlg). TFDS lists it as "No known license", a catalogue placeholder — [TFDS catalog](https://tensorflow.google.cn/datasets/community_catalog/huggingface/recipe_nlg). Paper — [INLG 2020](https://www.aclweb.org/anthology/2020.inlg-1.4.pdf)
- **Recipe1M+**: the MIT DSpace record lists CC BY-NC-SA 4.0 — [MIT DSpace](https://dspace.mit.edu/handle/1721.1/130340); paper — [arXiv 1810.06553](https://arxiv.org/pdf/1810.06553). Processed derivatives keep the same licence — [HF Recipe-1m-processed](https://huggingface.co/datasets/Shafiya123/Recipe-1m-processed)
- **Food.com (Majumder et al.)**: 270K recipes and 1.4M interactions over 18 years, scraped from Food.com — [Papers with Code](https://paperswithcode.com/dataset/food-com-recipes-and-interactions). The Kaggle "Food.com – Recipes and Reviews" (irkaal) set has 522,517 recipes in 312 categories with cook times, servings, ingredients, **nutrition** and instructions, plus 1,401,982 reviews. No licence field was shown in the mirror — [Baselight mirror](https://baselight.app/u/kaggle/dataset/irkaal_foodcom_recipes_and_reviews)
- **Epicurious**: I could not find the hugodarwood "Recipes with Rating and Nutrition" page. Another Kaggle Epicurious set has about 7,000 recipes, last updated 2019 — [DataCamp notebook](https://www.datacamp.com/datalab/w/3f14a60c-078f-4a8c-8444-95c29801b946/edit). An unrelated Kaggle "All Recipes" set includes calories, fat, carbs and protein — [Baselight](https://baselight.app/u/kaggle/dataset/sharathkumarerla_all_recipies_dataset)
- **Open Recipes (fictivekin)**: YAML-based and "more intended to be used as a recipe bookmark"; licence not found — [alternativebit.fr](https://alternativebit.fr/posts/open-receipe-database-how-to-gather-and-cure-data/)
- **Wikibooks Cookbook**: the HF dump (scraped 2024-07-31) is tagged CC BY-SA 4.0 — [HF wikibooks-cookbook](https://huggingface.co/datasets/gossminn/wikibooks-cookbook/raw/main/README.md). The Category:Recipes listing shows 3,819 pages, which may include non-recipe pages — [Wikibooks Category:Recipes](https://en.wikibooks.org/wiki/Category:Recipes)

### Inferences
- For a commercial app, only Wikibooks has a clearly usable licence, and share-alike would apply to the recipe text you redistribute. Even for a private 2–4 person household app, the non-commercial research terms of RecipeNLG and Recipe1M+ arguably don't cover product use.
- RecipeNLG ingredients are free-text strings with an NER list of food names, with no grams (my recollection; unverified here). They would need parsing and FDC matching.
- Food.com nutrition is reportedly given as calories plus %DV fields per serving (from memory; unverified). It is scraped data, so treat it as research-only.

### Gaps
- The Kaggle licence fields for Food.com (shuyangli94 and irkaal) and Epicurious (hugodarwood) could not be read. The Kaggle pages weren't reachable and searches returned nothing.
- The Open Recipes licence file wasn't retrieved.

## USDA sources with recipes: MyPlate Kitchen, FNDDS, SNAP-Ed

### Takeaway
USDA FoodData Central (including FNDDS mixed dishes) is public domain (CC0), free, and allows 1,000 requests/hour. It is the nutrition backbone of choice. MyPlate Kitchen has hundreds to over a thousand recipes with full nutrition analysis, mostly USDA/FNS-authored. USDA printables are public domain, but I found no blanket licence statement for every recipe.

### Cited Findings
- FDC data are public domain, not copyrighted, under CC0 1.0. Attribution is requested, not required. The default rate limit is 1,000 requests/hour per IP, and exceeding it blocks the key for 1 hour. Higher limits are available on request — [FDC API Guide](https://fdc.nal.usda.gov/api-guide)
- The FDC API exposes FNDDS 2019–2020 — [FDC API Guide](https://fdc.nal.usda.gov/api-guide). FNDDS holds "foods as consumed… includes mixed dishes" (tool documentation; secondary) — [ToolUniverse FDC tool](https://zitniklab.hms.harvard.edu/ToolUniverse/_modules/tooluniverse/fooddata_central_tool.html)
- DEMO_KEY limits of 30 requests/hour and 50/day are from a third-party source; the official guide says only "much lower" — [dev.to](https://dev.to/scangeni_ventures/fooddata-central-api-3b7i); [FDC API Guide](https://fdc.nal.usda.gov/api-guide)
- MyPlate Kitchen gives a detailed nutrition analysis on each recipe. For ranged amounts the smaller amount is used, and where there is a choice, the first listed ingredient is used. Recipes come from FNS programs including CNPP and SNAP, and some may come from other contributors — [MyPlate About Us](https://MyPlate.gov/about-us)
- Size: "hundreds" of recipes per K-State SNAP-Ed — [K-State SNAP-Ed](https://www.k-state.edu/ks-snaped/recipes); "over a thousand" per USDA CSFP — [FNS CSFP recipes](https://www.fns.usda.gov/csfp/sharing-gallery/recipes-cookbooks); 109 results for the 30-minute filter alone — [MyPlate search](https://www.myplate.gov/search)
- MyPlate printable materials are public domain and can be reproduced without permission. This does not explicitly extend to every Kitchen recipe — [MyPlate resources](https://MyPlate.gov/resources)

### Inferences
- MyPlate Kitchen is the best legally clean, US English, nutrition-included seed set. Store USDA-authored recipes and check credits on third-party-contributed ones. Its filters (cook time, food group, cuisine) map to planner needs, but the set skews toward budget and health recipes.
- FNDDS mixed dishes such as "lasagna with meat" give generic per-100 g nutrition for quick estimates of eaten meals, but they are not recipes with instructions.

### Gaps
- There is no bulk download or API for MyPlate Kitchen (none found). Collecting it would mean scraping a government site, which is legal for public-domain content but should still respect robots.txt.
- The exact recipe count and per-recipe licence status are unconfirmed. SNAP-Ed Connect recipe licensing was not researched.

## Building our own library (user-entered + AI-drafted, nutrition from FDC) and cheapest robust approach for 1 household

### Takeaway
The cheapest robust option is to own the library. Seed it with MyPlate Kitchen (public domain) and user-entered or AI-drafted recipes stored with gram amounts, and compute calories and macros from FDC (free, CC0, 1,000 req/hr). Data cost is $0/month, with no storage limits or attribution conditions. Licensed APIs add $9–$149/month while forbidding the permanent storage a calorie log needs.

### Cited Findings
- FDC is free, CC0 and allows 1,000 requests/hour — [FDC API Guide](https://fdc.nal.usda.gov/api-guide)
- Spoonacular forbids storing ingredients and nutrition beyond 1 hour — [spoonacular terms](https://spoonacular.com/food-api/terms). Edamam caches only macros, behind a login, and requires deletion on cancel — [Edamam FAQ](https://developer.edamam.com/api/faq)
- Lowest paid tiers: Spoonacular Cook $29/mo (the free 50 points/day may suffice) — [spoonacular pricing](https://spoonacular.com/food-api/pricing); Edamam Recipe Search $9/mo — [Edamam Recipe Search API](https://developer.edamam.com/edamam-recipe-api); TheMealDB about $10 one-time — [apievangelist](https://apis.apievangelist.com/store/mealdb-premium-api/)
- Commercial tools already sell an "FDC recipe nutrition enricher" (ingredient-to-FDC matching), which shows the approach is common — [Apify USDA FDC enricher](https://apify.com/jungle_synthesizer/usda-fdc-recipe-nutrition-enricher)

### Inferences
- Cost comparison for 2–4 users:
  - **(a) Own library + FDC: $0 data cost.** The remaining cost is LLM tokens for drafting recipes and matching ingredients. I did not source token costs here; another researcher covers LLM pricing. Assumed small: tens of recipes a month.
  - **(b) Spoonacular free tier: $0** but not storable, and it hits the 50-point/day ceiling. **$29/mo** for headroom.
  - **(c) Edamam Basic: $9/mo**, with attribution, no instructions, and macros only cacheable.
  - **(d) TheMealDB: ~$10 one-time** with no nutrition.
- Recommended stack:
  1. Own Postgres recipe tables with ingredient rows (fdc_id, grams).
  2. Seed with MyPlate Kitchen plus a few Wikibooks recipes, with CC BY-SA attribution.
  3. Users paste or enter recipes; the AI parses them to grams and matches FDC IDs, and the user confirms.
  4. Cache FDC nutrient values locally (allowed under CC0).
  5. Optionally use the Spoonacular free tier for live "inspiration" search only, storing just the ID, title and image.
- Engineering risk is in the ingredient parsing, unit-to-gram conversion (FDC portion data) and match accuracy, not in licensing.

### Gaps
- Not sourced here: LLM token cost for AI-drafting about 20–50 recipes a month, and hosting cost.
- No source quantified FDC-matching accuracy versus Edamam or Spoonacular nutrition.
