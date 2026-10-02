# Which database could supply packaged and branded foods?

Research for [01-packaged-food-databases](../issues/01-packaged-food-databases.md). Gathered 2026-10-01 from official docs, licence texts, and live queries against the FoodData Central (FDC) and Open Food Facts (OFF) APIs.

## Answer

**Use USDA FoodData Central's Branded Foods data type.** The app already calls this API for the Food Library. It is public domain (CC0), free (1,000 requests an hour), US-focused, keyed by GTIN/UPC, and the API gets new products monthly (the newest records are dated 2026-09-24). Its nutrient data comes straight from manufacturers' Nutrition Facts panels. Open Food Facts covers about the same US products, but much of its US data was imported from USDA in the first place. On top of that it brings an ODbL share-alike licence, a limit of 15 product reads a minute, and crowd-edit errors. FatSecret and Edamam don't let the app keep the data, and Nutritionix is sales-only.

**For calorie tracking, a generic match is usually good enough per gram, but not per piece.** Store-brand and name-brand versions of the same product land within about ±5% kcal/100 g of each other and of the SR Legacy generic. That is smaller than the error labels themselves are allowed. The real errors come from serving weight (one "flour tortilla" weighs 22 g to 104 g) and from variants that share a name ("light", "low-carb", "double stuf").

**Change the Food Library model now, in small ways:** add a source, a source ID, a nullable GTIN and brand, and per-serving gram weights alongside the canonical per-100 g values. Don't build barcode scanning or a branded import yet.

## Comparison

| | **FDC Branded Foods** | **Open Food Facts** | **FatSecret Platform** | **Edamam Food DB** | **Nutritionix** |
|---|---|---|---|---|---|
| Cost | Free (data.gov key) | Free | Basic and Premier Free tiers are free; Premier is quoted on request | From $14/month (Enterprise Basic) | Sales-only (now part of Syndigo) |
| Rate limit | 1,000 req/hour/IP; DEMO_KEY 30/hour, 50/day | 15 product reads/min/IP, 10 searches/min/IP, IP bans for overuse | Basic 5,000 calls/day; Premier Free unlimited | 50 to 300/min by plan; 100k calls/month on Basic | n/a |
| Licence | CC0 public domain; citation requested | ODbL (database) + DbCL (contents) + CC BY-SA (images); share-alike | Proprietary; attribution required on free tiers | Proprietary; attribution required | Proprietary |
| Can we store it? | Yes, forever | Yes, but see ODbL obligations below | **No**: 24 h maximum except IDs | Only kcal/protein/carbs/fat on Core+; **Basic tier may cache only the food ID and label** | Contract terms |
| US coverage | ~434k branded records in the API (US, Canada, NZ market countries) | ~979k products tagged United States, many imported from USDA | US dataset on free tiers | 700k+ UPC/EAN codes (global) | Large US DB (no public figures) |
| Freshness | API updated monthly; bulk download twice a year (latest file Dec 2025) | Continuous crowd edits | Vendor-maintained | Vendor-maintained | Vendor-maintained |
| Barcode | `gtinUpc` field; searchable by UPC | Product lookup by barcode is its main use | Yes, on all tiers | Yes | Yes |
| Data shape | Per 100 g/ml (computed from label) + `labelNutrients` per serving + serving size in g/ml + household text | Per 100 g + per serving; free-text `serving_size` + parsed `serving_quantity` | Per serving, several servings per food | Per 100 g + measures | Per serving |

### USDA FoodData Central: Branded Foods

- **Cost and limits.** Free with a data.gov key. "1,000 requests per hour per IP address", and DEMO_KEY allows only 30 an hour and 50 a day ([FDC API Guide](https://fdc.nal.usda.gov/api-guide/)). These are the same key and endpoints the Food Library already uses. Branded Foods is just another `dataType`.
- **Licence.** "CC0 1.0 Universal". The requested citation is "U.S. Department of Agriculture, Agricultural Research Service. FoodData Central" ([API Guide](https://fdc.nal.usda.gov/api-guide/)). There are no share-alike or commercial limits, so it is safe for a product sold later. Brand names are trademarks, but naming a product to identify it is fine.
- **Where the data comes from.** It's a public-private partnership (ARS, IAFNS, GS1 US, 1WorldSync, UMD JIFSAN). "Companies submit product data to 1WorldSync through the Global Data Synchronization Network", and data providers "are responsible for descriptions, nutrient data, serving size, and ingredient information". Submission is voluntary ([GBFPD User Guide, Jan 2024](https://fdc.nal.usda.gov/docs/GBFPD_Documentation_and_Download_User_Guide_Jan2024.pdf)). Records carry `dataSource` values such as `GDSN` and `LI` (Label Insight). Market countries are the United States, Canada and New Zealand.
- **Freshness.** The download files are "updated twice each year, typically in April and October", and the API carries "monthly updated data in between" ([GBFPD User Guide](https://fdc.nal.usda.gov/docs/GBFPD_Documentation_and_Download_User_Guide_Jan2024.pdf)). The download page currently offers the December 2025 Branded file (195 MB zipped JSON, 3.1 GB unzipped) ([Download Datasets](https://fdc.nal.usda.gov/download-datasets/)). A live API query sorted by `publishedDate` returned records published **2026-09-24** (Rich's pizza crust, Polar seltzer, Cookie Crisp), and a `*` search over Branded returned 433,916 hits.
- **Data shape.** "USDA standardizes the reported values by calculating nutrient values per 100 grams from those values provided per serving", and "Data are converted to a 100-unit basis, either gram (g) or milliliter (ml)" ([GBFPD User Guide](https://fdc.nal.usda.gov/docs/GBFPD_Documentation_and_Download_User_Guide_Jan2024.pdf)). Each record also has `servingSize` + `servingSizeUnit` (e.g. `34 GRM`), `householdServingFullText` (e.g. "3 cookies"), `labelNutrients` (per-serving values as printed), `gtinUpc`, `brandOwner`, `brandName`, `brandedFoodCategory`, `packageWeight`, `ingredients`, and `modifiedDate`/`availableDate`/`discontinuedDate` (seen in a live `/food/2550059` response).
- **Caveats** ([GBFPD User Guide](https://fdc.nal.usda.gov/docs/GBFPD_Documentation_and_Download_User_Guide_Jan2024.pdf)):
  - "Missing values do not indicate a zero value."
  - "Label rounding may introduce additional variability in the 100 g or 100 ml values", especially for small servings.
  - When a GTIN is duplicated, the latest `publication_date` is the current version.
  - Live data also contains manufacturer typos: serving units of `MG` where grams were meant (Oreo 044000035655: "34.0 MG"), and impossible energy values (De Casa flour tortillas at 11 kcal/100 g, Tortilleria Brenda at 619 kcal/100 g). An import needs a sanity check, such as kcal/100 g compared with 4·carb + 4·protein + 9·fat.

### Open Food Facts

- **Cost and limits.** Free. "15 req/min/IP address for all read product queries" and "10 req/min/IP address for all search queries; don't use it for a search-as-you-type feature, you would be blocked very quickly". Going over risks an IP ban. A custom `User-Agent` of the form `AppName/Version (ContactEmail)` is required. "If you need to fetch more than a few hundred products, we ask you to download the data as a CSV or JSONL file" ([OFF API docs](https://openfoodfacts.github.io/openfoodfacts-server/api/), [source](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/docs/api/index.md)). During this research the facet and search endpoints returned "Page temporarily unavailable"/HTTP 503 more than once, while single-product reads worked.
- **Licence.** The database is under the Open Database License, the individual contents under the Database Contents License, and the images under CC BY-SA. Commercial use is allowed. You must "attribute the authorship to Open Food Facts with a link", and "Derivative works must be shared under the same conditions" ([OFF Terms of use](https://world.openfoodfacts.org/terms-of-use)). The ODbL obligations that matter for a product someone might sell ([ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)):
  - **4.4 Share alike:** "Any Derivative Database that You Publicly Use must be only under the terms of this License." If OFF rows are merged and edited into the Food Library and the result is offered to the public, then the **Food Library itself** has to be offered under ODbL. Under 4.6 that means giving people the entire derivative database or a file of the changes.
  - **4.5:** share-alike doesn't reach a "Collective Database", meaning the OFF data kept unmodified alongside independent databases. "Using this Database ... to create a Produced Work does not create a Derivative Database." So a separate, unmodified OFF table plus an on-screen notice (4.3) is the lowest-obligation way to use it.
  - **"Publicly"** means anyone other than you or people under your control. A single household arguably isn't public, but selling the app would be.
- **US coverage.** The US site shows "979,106 products" ([us.openfoodfacts.org](https://us.openfoodfacts.org/)). Much of it is USDA's own Branded data. In a live lookup, the Oreo record (0044000032029) and Great Value cookies (0078742084954) both list `data_sources_tags: ["database-usda", ...]`, with nutrient fields imported from `database-usda` (import time 2020-04-23). So OFF adds crowd-photographed products on top of a copy of FDC Branded.
- **Data quality.** It is crowd-edited, and each product carries a `completeness` score (0.58 to 0.79 for the four products checked) and `data_quality_warnings_tags`. Example: the Oreo record's serving size was edited to "3g", so its `energy-kcal_serving` reads **14.1 kcal** instead of 160.
- **Data shape.** `nutriments.energy-kcal_100g` and `energy-kcal_serving`, `nutrition_data_per` (`100g` or `serving`), and `serving_size` as free text ("3 COOKIES (34 g)") with a parsed `serving_quantity` (34).

### Others

- **FatSecret Platform API.** The free tiers are Basic (5,000 calls a day, US data) and Premier Free (unlimited, for startups under US$1M revenue and US$1M funding). Both include barcode lookup and require attribution ([API editions](https://platform.fatsecret.com/api-editions)). The deal-breaker hasn't changed: "You may not cache any user data for more than 24 hours, with the exception of information that is explicitly 'storable indefinitely'", which covers only IDs such as `food_id` and `serving_id` ([Storable data](https://platform.fatsecret.com/docs/guides/storable-data)). Calorie values would have to be fetched again every time, which doesn't fit a Food Library that keeps foods for good. Only worth looking at as a live lookup service, and probably not even then.
- **Edamam.** This has changed since it was ruled out: there is now a $14/month Enterprise Basic plan (100k calls a month, 30-day trial). But attribution is mandatory, and Basic may cache only the food ID and label, not kcal. Core ($69/month) and up may cache kcal/protein/carbs/fat ([Edamam Food DB API](https://developer.edamam.com/food-database-api)). Paying for data FDC gives away doesn't make sense.
- **Nutritionix.** Still no public pricing. It is sales-only through Syndigo account executives ([Nutritionix API guide](https://docx.riversand.com/developers/docs/nutritionix-api-guide); nutritionix.com/api returned HTTP 402). Still ruled out.

## Do near-identical products differ enough to matter?

All numbers below come from live FDC API queries (Branded and SR Legacy). The kcal/100 g figure is FDC's value computed from the label.

**Chocolate sandwich cookies**

| Product | Serving | kcal/serving (label) | kcal/100 g |
|---|---|---|---|
| SR Legacy generic: Cookies, chocolate sandwich, with creme filling, regular (172718) | n/a | n/a | **464** |
| Oreo, 3 cookies (044000032029 and many others) | 34 g | 160 | 471 |
| Oreo, 2 cookies (044000054809) | 29 g | 140 | 483 |
| Oreo 1-pack snack packs | 22 g | 100 or 110 | 455 to 500 |
| Great Value (Walmart) | 34 g | 160 | 471 |
| Market Pantry (Target) | 34 to 35 g | 160 | 457 to 471 |
| Kroger / Price Chopper / Giant Eagle | 34 g | 150 | 441 |
| SR Legacy: with **extra** creme filling (172720) | n/a | n/a | 497 |
| SR Legacy: reduced fat (171841) | n/a | n/a | 436 |

The regular store brands and Oreo all fall between 441 and 483 kcal/100 g. The generic (464) is within −5% to +4% of every one of them. On a 3-cookie serving that is 150 to 160 kcal, against 158 kcal for the generic. Oreo's own packs differ more from each other (455 to 500) than store brands differ from Oreo. That spread is label rounding, not recipe.

**Flour tortillas**

- Regular flour tortillas (about 80 brands checked, including Mission 280 to 286, Guerrero 293 to 305, Meijer 281 to 286, Hy-Vee 275 to 298, Great Value soft taco, Market/Archer Farms 295) mostly fall between **273 and 325 kcal/100 g**. The SR Legacy generics are 297 (shelf-stable) and 306 (refrigerated), so the generic per gram is within about ±8%.
- **Per tortilla, the spread is enormous:** listed serving weights for "1 tortilla" run from 22.6 g to 104 g (25 to 71 g is common). If a generic "1 tortilla" is logged without knowing the size, it can be off by 2 to 3 times.
- **Same name, different food:** Great Value "FLOUR TORTILLAS" (078742294834) is a high-fibre, modified-wheat-starch tortilla at 70 kcal per 42 g (**167 kcal/100 g**, 13 g fibre). Kroger's 011110126337 is similar at 163. A match on name alone would overstate these by about 80%.

**How precise are the labels themselves?** FDA requires calories to be "expressed to the nearest 5-calorie increment up to and including 50 calories, and 10-calorie increment above 50 calories" (21 CFR 101.9(c)(1)). A food is misbranded only if its actual calories are "greater than 20 percent in excess of the value ... declared on the label" (21 CFR 101.9(g)(5)) ([eCFR 21 CFR 101.9](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-A/section-101.9)). On a 160 kcal serving, rounding alone is ±5 kcal (±3%), and the legal tolerance runs to +20%.

**Conclusion.** For "same kind of product, regular version", a generic per-100 g match is as accurate as the brand's own label. The ±5% gap between brands is inside the label's own uncertainty. What does matter:

1. **Weight per piece.** Store servings in grams and ask, or default to the household serving's gram weight.
2. **Variant words.** Light, reduced fat, low-carb, high-fibre, keto, double/mega stuf, and "carb balance" mark a different food, and the matcher should treat them that way.

So branded data is a nice-to-have for convenience (barcode, exact serving sizes) more than for accuracy.

## Recommendation

**FDC Branded Foods, in a later phase,** looked up through the same FDC API as the existing Food Library. Search by name or GTIN with `dataType=Branded`, and copy the chosen record into the Food Library the way Foundation/SR Legacy foods are cached. Reasons:

- It is CC0, so it's safe if the app is ever sold. It needs no new vendor and no new key, and it costs nothing.
- Its numbers come from the manufacturer's label: the same values a person would type in, and the same values OFF copies.
- It has GTINs, so barcode lookup can come later with no change of source. A phone scanner can turn the barcode into a GTIN and look it up through FDC search, or through a local GTIN index built from the twice-yearly bulk file if lookups get heavy.

**Skip Open Food Facts for now.** Revisit it only if FDC misses too many barcodes in real use (regional or very new products). In that case, store OFF rows unmodified in their own table with the attribution notice so they stay a Collective Database, and never merge them into the Food Library.

**Weaknesses to plan for:** stale and duplicate records (prefer the latest `publishedDate` per GTIN and ignore any with a `discontinuedDate`), manufacturer typos (check kcal against the macros), and no coverage of restaurant food (still the AI estimate fallback).

## Should the Food Library's data model change now?

Yes. These are cheap additions that avoid a migration later:

- **`source`**: enum such as `usda_foundation`, `usda_sr_legacy`, `usda_branded`, `manual`, `ai_estimate` (and later `off`). It shows a Member where a number came from, and lets the app refresh or replace foods by source.
- **`source_id`**: the FDC `fdcId` (or another vendor's ID), unique together with `source`.
- **`gtin`**: nullable **text**, not a number, because leading zeros matter and FDC returns 8-, 12-, 13- and 14-digit forms such as `00146739`, `044000032029` and `0044000070588`. Store it normalised to 14 digits (GTIN-14) and index it.
- **`brand`**: nullable text (`brandOwner`/`brandName`).
- **Keep kcal per 100 g (or per 100 ml) as the single canonical value**, which both USDA data types and OFF already provide. Add a **`unit_basis`** of g or ml for drinks.
- **Serving sizes as a child list** (label, grams), e.g. "3 cookies = 34 g" or "1 tortilla = 42 g". SR Legacy already supplies similar household measures through `foodPortions`, so one structure serves both. For branded rows, mark the serving that came from the label (`householdServingFullText` + `servingSize`).
- Optionally, **`source_updated_at`** (FDC `publishedDate`/`modifiedDate`) for refreshes.

Don't add yet: barcode scanning, a bulk import of the 3 GB Branded file, OFF integration, or per-serving-only calorie storage. Per-serving calories can always be derived from per-100 g × serving grams.

## Sources

- FDC API Guide: https://fdc.nal.usda.gov/api-guide/
- FDC Data Documentation (data types, update frequency): https://fdc.nal.usda.gov/data-documentation/
- GBFPD Documentation and Download User Guide (Jan 2024): https://fdc.nal.usda.gov/docs/GBFPD_Documentation_and_Download_User_Guide_Jan2024.pdf
- FDC Download Datasets: https://fdc.nal.usda.gov/download-datasets/
- FDC API live queries: `https://api.nal.usda.gov/fdc/v1/foods/search` (Branded and SR Legacy; queries "chocolate sandwich cookies", "flour tortillas", "mission flour tortillas soft taco"; GTIN 044000032029; sorted by publishedDate) and `/fdc/v1/food/2550059`, run 2026-10-01
- Open Food Facts API docs: https://openfoodfacts.github.io/openfoodfacts-server/api/ (source: https://github.com/openfoodfacts/openfoodfacts-server/blob/main/docs/api/index.md)
- Open Food Facts terms of use: https://world.openfoodfacts.org/terms-of-use
- Open Food Facts US site product count: https://us.openfoodfacts.org/
- OFF live product reads: `https://world.openfoodfacts.org/api/v2/product/{0044000032029,0078742084954,0073731071212,0078742294834}.json`, run 2026-10-01
- ODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/
- FatSecret API editions: https://platform.fatsecret.com/api-editions
- FatSecret storable data: https://platform.fatsecret.com/docs/guides/storable-data
- Edamam Food Database API: https://developer.edamam.com/food-database-api
- Nutritionix API guide (Syndigo): https://docx.riversand.com/developers/docs/nutritionix-api-guide
- 21 CFR 101.9 (eCFR): https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-A/section-101.9
- Previous decision: [Where do calorie counts come from?](../../mvp/issues/02-calorie-data-sources.md)
