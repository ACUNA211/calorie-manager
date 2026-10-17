# Barcode and packaged-food nutrition databases (US, October 2026)

Gathered 2026-10-17. Builds on `.scratch/mvp-reset/research/packaged-food-databases.md` (2026-10-01), which ran live FDC and OFF queries. **Method limits this round:** the sandbox proxy refused connections to `api.nal.usda.gov`, `world.openfoodfacts.org` and `api.upcitemdb.com`, and WebFetch could not resolve any vendor domain (fdc.nal.usda.gov, openfoodfacts.github.io, go-upc.com, barcodelookup.com, ean-search.org, upcitemdb.com). That means **no live API queries and no full primary-page reads happened this round**. Re-verification relies on search-engine extracts of primary pages, where those were returned, plus the 2026-10-01 live results. Claims resting only on third-party or competitor pages are marked **(unverified)**. One route not taken: the app's Supabase database already has `public.usda_get(path)` (supabase/migrations/003_usda_functions.sql), which calls FDC with the Vault key. Running the GTIN checks through it would have meant using the user's production key and database for research, so it was left for the user to decide.

## 1. USDA FoodData Central: macro fields by data type, Branded completeness, GTIN lookup, limits, licence

### Takeaway
FDC is free and CC0 (storable forever, commercial use allowed), and its Branded type gives per-serving label macros (`labelNutrients`) plus per-100 g nutrients for most US packaged foods. The one structural catch for macros is energy: Foundation Foods no longer carries nutrient 1008 "Energy" and uses Atwater IDs 2047/2048 instead. There is no barcode endpoint. A GTIN "lookup" is a full-text search, so the app must zero-normalise the code and check that the returned `gtinUpc` actually matches.

### Cited Findings
- Limits: "1,000 requests per hour per IP address", DEMO_KEY 30/hour and 50/day. Licence CC0 1.0, with a requested citation "U.S. Department of Agriculture, Agricultural Research Service. FoodData Central". Verified live and on the guide 2026-10-01; not re-fetchable today — [FDC API Guide](https://fdc.nal.usda.gov/api-guide/) (via prior notes)
- Branded is about 434k records in the API (a live `*` search on 2026-10-01 returned 433,916). Market countries are the US, Canada and NZ. Manufacturers supply the data through GDSN/1WorldSync and Label Insight, and submission is voluntary. "Missing values do not indicate a zero value." — [GBFPD User Guide Jan 2024](https://fdc.nal.usda.gov/docs/GBFPD_Documentation_and_Download_User_Guide_Jan2024.pdf) (via prior notes)
- Branded values are "per 100 grams [computed] from those values provided per serving". Each record has `servingSize`/`servingSizeUnit`, `householdServingFullText` and `labelNutrients` (per serving, as printed) — [GBFPD User Guide](https://fdc.nal.usda.gov/docs/GBFPD_Documentation_and_Download_User_Guide_Jan2024.pdf); live `/food/2550059` on 2026-10-01 (prior notes)
- Bulk Branded download: December 2025 file, 195 MB zipped / 3.1 GB unzipped JSON. Downloads are "updated twice each year, typically in April and October", and the API is updated monthly (newest records seen 2026-09-24) — [Download Datasets](https://fdc.nal.usda.gov/download-datasets/) (via prior notes)
- Branded data are "nutrient values typically obtained from food label data provided by food brand owners". For duplicated `gtin_upc`, "the latest publication date will be the most current record" — [FDC Download Field Descriptions](https://fdc.nal.usda.gov/docs/Download_Field_Descriptions_Oct2020.pdf) (search extract)
- Energy in Foundation Foods: general-factor energy is "Metabolizable Energy (Atwater General Factor)", nutrient ID **2047**, and specific-factor energy is ID **2048**. "Energy" ID **1008** "will no longer display in FoodData Central's Foundation Foods, but will continue to display for the other food data types" (since Oct 2020) — [Foundation Foods Documentation Apr 2024](https://fdc.nal.usda.gov/docs/Foundation_Foods_Documentation_Apr2024.pdf); [Foundation Foods Documentation](https://fdc.nal.usda.gov/Foundation_Foods_Documentation/); [FDC FAQ](https://fdc.nal.usda.gov/faq/) (search extracts)
- FNDDS (Survey) computes energy with Atwater factors, falling back to general factors when specific ones aren't provided. FNDDS is a complete-profile dietary-survey database — [2021–2023 FNDDS documentation](https://www.ars.usda.gov/ARSUserFiles/80400530/pdf/fndds/2021_2023_FNDDS_Doc.pdf) (search extract)
- GTIN lookup: FDC has no barcode endpoint, so a barcode query is a fuzzy full-text search. Stored codes are zero-padded inconsistently. One project found the 13-digit padded UPC returned nothing while the 12-digit form matched exactly. An unknown code returns many unrelated foods, so check `gtinUpc` (compare with leading zeros stripped) — [JonnyC26/scanner-backend PR #46](https://github.com/JonnyC26/scanner-backend/pull/46); [usda-fdc Python client quickstart](https://usda-fdc.readthedocs.io/en/stable/user/quickstart.html); [calorieapi.com FDC guide](https://calorieapi.com/blog/usda-fooddata-central-api-guide) (community sources, **unverified on USDA docs**)
- EAN-8 codes with leading zeros may fail if the client strips a zero while USDA stores the 8-digit form (the reporter could not confirm a real case) — [mlewand/macrofill issue #90](https://github.com/mlewand/macrofill/issues/90)
- Live data seen 2026-10-01 contained 8-, 12-, 13- and 14-digit `gtinUpc` forms (`00146739`, `044000032029`, `0044000070588`), plus manufacturer errors: serving unit "MG" where grams were meant, and tortillas at 11 and 619 kcal/100 g — prior notes, live FDC queries
- The search endpoint errors on `pageNumber >= 100`, which matters for bulk crawling through the API instead of the download — [USDA/USDA-APIs issue #100](https://github.com/USDA/USDA-APIs/issues/100)

### Macro field map (nutrient numbers from working knowledge; **unverified this session** because FDC docs were unreachable)
| Macro | Nutrient ID (`foodNutrients`) | Branded `labelNutrients` key | Foundation | SR Legacy | FNDDS |
|---|---|---|---|---|---|
| Energy kcal | 1008 (Branded/SR/FNDDS); 2047/2048 (Foundation, cited above) | `calories` | 2047/2048 only (cited) | 1008 | 1008 |
| Protein | 1003 | `protein` | yes | yes | yes |
| Total fat | 1004 | `fat` | yes | yes | yes |
| Carbohydrate, by difference | 1005 (Foundation may also have 1050 "by summation") | `carbohydrates` | usually | yes | yes |
| Fibre, total dietary | 1079 | `fiber` | often | mostly | yes |
| Sugars, total | 2000 (Branded/SR), 1063 in some Foundation rows | `sugars` (+ `addedSugars` on newer labels) | partial | partial (many SR rows lack sugars) | yes |
| Sodium | 1093 | `sodium` | yes | yes | yes |
| Saturated fat | 1258 | `saturatedFat` | yes | yes | yes |

- FNDDS is designed as a complete profile (about 65 nutrients per food) and SR Legacy is mostly complete. Branded completeness follows the label: calories, fat, sat fat, sodium, carbs, sugars and protein are mandatory on the US Nutrition Facts panel ([21 CFR 101.9](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-A/section-101.9)), so they should be present on most label-derived records. Fibre is also mandatory (21 CFR 101.9(c)(6)(i)); the citation is the same, but this exact clause was not re-read this session.

### Inferences
- For a per-gram macro model, read `foodNutrients` by nutrient ID (per 100 g), with fallbacks: energy 1008 → 2047 → 2048 → computed 4P+4C+9F. Keep `labelNutrients` and `servingSize` for display and for "1 serving".
- Normalise every scanned code to GTIN-14 for storage, then query FDC with the 12-digit UPC-A form first (strip the leading zeros from GTIN-14), then the 13-digit form. Accept a hit only if `ltrim(gtinUpc,'0') == ltrim(scan,'0')`, and prefer the latest `publishedDate`.
- At 50–200 scans a month, the free 1,000/hour key is about 0.03% used. The 3 GB bulk file is not needed.

### Gaps
- Branded macro fill-rates (what % of records lack fibre, sugars and so on) were not measured; that needs the live API or the bulk file. Nutrient IDs and `labelNutrients` key names are from working knowledge, not re-verified. Whether a newer bulk Branded file (April 2026 or October 2026) is now on the download page was not checked.

## 2. Open Food Facts

### Takeaway
Free, commercial use allowed, about 979k US-tagged products (many copied from FDC). Rate limits are unchanged in the official docs (15 product reads/min/IP, 10 searches/min/IP). The ODbL share-alike licence is manageable if OFF rows sit unmodified in their own table.

### Cited Findings
- "15 req/min/IP address for all read product queries" and "10 req/min/IP address for all search queries". Overuse can get an IP banned. When users make requests directly, the limits apply per user. Bulk users of more than a few hundred products should use the CSV/JSONL dumps — [OFF API docs](https://openfoodfacts.github.io/openfoodfacts-server/api/) (search extract, 2026-10-17; matches prior notes)
- A 2023 proposal for 30 req/min was never confirmed as adopted — [openfoodfacts-server issue #8818](https://github.com/openfoodfacts/openfoodfacts-server/issues/8818). Third-party claims of "no rate limiting" conflict with the docs — [NutriGraphAPI notes](https://nutrigraphapi.com/blog/open-food-facts-api-pricing/), [calorieapi.com](https://calorieapi.com/blog/open-food-facts-api-rate-limit-production-app) (not relied on)
- Licence: ODbL (database), DbCL (contents), CC BY-SA (images). Attribution with a link is required, and derivative databases must be shared alike — [OFF Terms of use](https://world.openfoodfacts.org/terms-of-use); [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) (prior notes)
- US site showed 979,106 products. Sampled US records carry `data_sources_tags: database-usda`, so a lot of OFF US data is imported FDC Branded — [us.openfoodfacts.org](https://us.openfoodfacts.org/); live reads 2026-10-01 (prior notes)
- Macro fields: `nutriments.energy-kcal_100g`/`_serving`, plus `proteins_`, `carbohydrates_`, `fat_`, `saturated-fat_`, `sugars_`, `fiber_` and `sodium_`/`salt_` with `_100g` and `_serving` suffixes. Field names are from working knowledge, **unverified this session**. `energy-kcal` and `serving_quantity` were confirmed live 2026-10-01.
- Quality: `completeness` scores of 0.58–0.79 on sampled products. Example error: Oreo serving edited to "3g", so kcal/serving read 14.1 instead of 160 — prior notes, live OFF read 2026-10-01

### Inferences
- Use OFF only as a fallback after an FDC miss. Store its rows unmodified in a separate `off_products` table with on-screen attribution (a Collective Database, ODbL 4.5). Prefer `_100g` over `_serving` and run the same 4/4/9 sanity check.
- At 15 reads/min, a household scanning about 7 items a day is far below the limit. Send the required User-Agent `AppName/Version (email)`.

### Gaps
- No live re-check of the US product count or of macro fill-rates. Whether the 503 instability on search seen 2026-10-01 continues is unknown.

## 3. Barcode-only databases: UPCitemdb, Barcode Lookup, Go-UPC, EAN-Search

### Takeaway
These are product-identity services (name, brand, images, prices). UPCitemdb's free tier (100 requests/day) is enough for a household, but it gives **no nutrition** (unverified). Go-UPC and Barcode Lookup may return some nutrition text, but they are paid ($75+/month) with unverified terms. None is worth paying for when FDC and OFF give macros for free.

### Cited Findings
- UPCitemdb: Free tier 100 requests/day (20 of them searches), no signup. DEV $99/month (20,000 lookups and 2,000 searches a day). PRO $699/month (150,000 lookups a day). Overage $0.04 per 100 lookups. HTTP 429 when over the limit — [UPCitemdb Plan Comparison](https://www.upcitemdb.com/wp/docs/main/development/plan/); [UPCitemdb API](https://upcitemdb.com/api) (search extract of official pages)
- UPCitemdb nutrition: none found in the plan or API extracts. In working knowledge, the response holds title, brand, description, images and offers, with no Nutrition Facts — **unverified**
- Go-UPC: Developer $74.95/month for 5,000 requests, Startup $245 for 45,000, Enterprise $795 for 450,000. No free tier, trial key on request — [ShopSavvy comparison (competitor)](https://shopsavvy.com/compare/shopsavvy-data-api-vs-go-upc) **(unverified)**. An older review says plans start at $19.95/month (likely stale) and that Go-UPC can return "nutrition facts" — [Geekflare](https://geekflare.com/dev/upc-lookup-apis/) **(unverified)**
- Barcode Lookup (barcodelookup.com): no official pricing retrieved. G2 says the vendor publishes no pricing there — [G2](https://www.g2.com/products/barcode-lookup-api/pricing). A competitor page says the vendor's plan page blocked its automated check — [ShopSavvy](https://shopsavvy.com/compare/barcode-lookup-alternatives). Whether `nutrition_facts`/ingredients fields come back is **unverified**
- EAN-Search: pricing and fields not retrieved (domain unreachable) — gap

### Inferences
- The only plausible use is a name-only fallback: when FDC and OFF both miss, UPCitemdb's free tier could prefill the product name and brand so the user only types the label macros. That saves typing but adds no macro coverage.

### Gaps
- Official Go-UPC, Barcode Lookup and EAN-Search pricing, storage terms and nutrition fields could not be read. Each vendor's site needs a manual check.

## 4. Commercial nutrition APIs: Nutritionix, FatSecret, Edamam, Spoonacular, Chomp, Passio

### Takeaway
All are proprietary, and the ones with readable terms restrict storage (FatSecret: 24 h except IDs; Edamam: only kcal/protein/fat/net carbs on caching-enabled paid plans, behind the user's login). That conflicts with a permanent shared pantry. None beats FDC for US packaged-food macros at this scale.

### Cited Findings
- FatSecret: Basic is free (self sign-up, 5,000 calls/day, US dataset only). Premier Free is for startups under US$1M revenue, includes "barcode scanning, auto-complete, food categories", and requires attribution. Premier (paid) is priced on request — [FatSecret Platform Editions](https://platform.fatsecret.com/api-editions); [Upgrade Account](https://platform.fatsecret.com/upgrade-account?type=1) (search extract). Prior notes say Basic also includes barcode, so it's **unclear whether barcode lookup is in Basic or only Premier Free**. `food.find_id_for_barcode.v2` launched November 2025 — [FatSecret blog](https://blog.fatsecret.com/tagged/nutrition%20data). Claims 90%+ global UPC/EAN coverage — [FatSecret Platform](https://platform.fatsecret.com/) (vendor claim)
- FatSecret storage: "You may not cache any user data for more than 24 hours, with the exception of information that is explicitly 'storable indefinitely'" (IDs only) — [Storable data](https://platform.fatsecret.com/docs/guides/storable-data) (prior notes)
- Edamam: "Data caching is allowed for some paid API plans", and then only "protein, total fat, net carbs and calories as well as the foodId, food label and food image". Caching does not allow building a copy or a food search. Cached data is usable "only ... in the end user's account, behind a password". Attribution is mandatory on all plans. "Only human, end user driven requests" are allowed — [Edamam Food Database API](https://developer.edamam.com/food-database-api) (search extract). Fibre, sugars and sodium therefore can't be stored. Prices: Enterprise Basic $14/month (100k calls, 50/min), Core $69/month (750k calls, 100/min) — [apis.io Edamam plans](https://apis.io/plans/edamam/edamam-plans-pricing/) **(third-party)**, consistent with prior notes from Edamam's page
- Nutritionix: no official public pricing found. A rival vendor claims the free tier covers 5 nutrients and full access is $449/month — [DEV Community post (competitor)](https://dev.to/raviteja_nekkalapu_/most-nutrition-apis-hide-80-of-the-data-behind-paywalls-mine-doesnt-49pl) **(unverified)**. Prior notes found it sales-only through Syndigo — [Nutritionix API guide (Syndigo)](https://docx.riversand.com/developers/docs/nutritionix-api-guide)
- Spoonacular: has a UPC lookup for US grocery products — [Microsoft connector docs](https://learn.microsoft.com/ja-JP/connectors/spoonacularfoodip). Pricing conflicts across resellers: free with 150 requests/day, Developer $29 and Startup $99 per [ApiSpine (2026-05-08)](https://apispine.com/spoonacular), or a different tier set on [APILayer](https://marketplace.apilayer.com/spoonacular-api). The points model (1 point/request + 0.01/result, nutrition surcharges, HTTP 402 when the free tier runs out) is per [apis.io](https://apis.io/plans/spoonacular/spoonacular-plans-pricing/). All third-party; **unverified**. The caching clause is in [spoonacular terms](https://spoonacular.com/food-api/terms) but was not read — gap
- Chomp: branded database with `/food/branded/barcode.php` returning "full nutrition facts", around 535k products (possibly stale). Pricing only at chompthis.com/api (not retrieved) — [Jentic listing](https://jentic.com/apis/chompthis.com/chompthis) **(unverified)**
- Passio Nutrition AI: token-based pricing. Starter (about 1–50 users) includes 10M tokens at $2.50 per 1M; Growth $2.00 per 1M with 150M tokens; Pro $1.50 per 1M. Auto-refill at $2.50 per 1M; the service stops when tokens run out with auto-refill off. Barcode recognition is a feature — [Passio cost breakdown](https://www.passio.ai/cost-breakdown); [Passio features](https://www.passio.ai/features); [Passio FAQ](https://www.passio.ai/faq). The base subscription fee and storage terms were not found — gap

### Inferences
- FatSecret and Edamam are ruled out for a permanent pantry by their storage terms. Nutritionix, Chomp and Go-UPC are opaque or paid. Passio is aimed at AI photo logging, not a cheap barcode-to-macros cache.

### Gaps
- Spoonacular, Chomp, Passio and Nutritionix storage/caching terms were not read. Chomp and Nutritionix prices are unconfirmed.

## 5. Cheapest robust combination and cost at 2–4 users, 50–200 products/month

### Takeaway
**$0/month.** Scan → normalise GTIN → FDC Branded search (free key, CC0, store permanently) → on miss, OFF product read (free, ODbL, separate table) → on miss, manual label entry (optionally prefilled with name/brand from UPCitemdb's free 100/day) → saved to the shared pantry so each product is fetched only once.

### Cited Findings
- FDC: free, 1,000 req/hour, CC0 — [FDC API Guide](https://fdc.nal.usda.gov/api-guide/)
- OFF: free, 15 product reads/min/IP — [OFF API docs](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- UPCitemdb free: 100 requests/day — [UPCitemdb plans](https://www.upcitemdb.com/wp/docs/main/development/plan/)
- Cheapest paid alternatives for comparison: Edamam $14/month (storage-limited) — [apis.io](https://apis.io/plans/edamam/edamam-plans-pricing/); Go-UPC $74.95/month — [ShopSavvy](https://shopsavvy.com/compare/shopsavvy-data-api-vs-go-upc) (unverified); UPCitemdb DEV $99/month

### Inferences
- Volume: 200 scans/month is about 7 a day. Even at about 2 FDC calls per scan (12- and 13-digit tries) plus an OFF call, that is under 1% of any free limit. The existing `usda_get` Supabase function and Vault key already cover the FDC leg.
- Expected hit rate: OFF largely mirrors FDC for US goods, so the OFF fallback mostly helps with very new, regional or store-brand items. The size of that miss rate is unmeasured, so log misses to find out.
- Robustness checks: verify the `gtinUpc` match; take the latest `publishedDate` and skip records with a `discontinuedDate`; reject a record if kcal/100 g differs from 4P+4C+9F by more than about 20%. Label tolerance is +20% (21 CFR 101.9(g)(5)), so the threshold is a judgement call. Show the source and let the user correct values.

### Gaps
- No measured FDC or OFF miss rate for a real household basket. That needs live scans, and the network was blocked this session.
