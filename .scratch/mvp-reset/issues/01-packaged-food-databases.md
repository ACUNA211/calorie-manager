# Which database could supply packaged and branded foods?

Type: research
Status: resolved
Assignee:
Blocked by: 

## Question

The MVP's Food Library is USDA FoodData Central (Foundation/SR Legacy, per the old map's [Where do calorie counts come from?](../../mvp/issues/02-calorie-data-sources.md)). Later, packaged foods (cookies, frozen meals, branded tortillas) should come from a database too. Compare USDA's own **Branded Foods** dataset, **Open Food Facts**, and any other free or cheap source. For each: cost and rate limits, licence (including use in an app that might be sold one day), coverage of US grocery products, data freshness, barcode support, and how the data is shaped (calories per 100 g and per serving). Also: how much do near-identical products differ, for example store-brand chocolate sandwich cookies against Oreos, so a generic match is good enough? Recommend one source for a later phase, and say whether the Food Library's design should change now to leave room for it.

## Comments

**Resolution (2026-10-01):** use **USDA FoodData Central Branded Foods**, reached through the FDC API the Food Library already uses. It's public domain (CC0), free at 1,000 requests an hour, has GTIN/UPC codes, and its values are label data given per 100 g and per serving. Open Food Facts isn't needed: its US data is mostly a 2020 copy of USDA's with crowd errors, its rate limits are tight, and its ODbL share-alike would apply to the Food Library if mixed in. FatSecret, Edamam and Nutritionix stay ruled out. A generic match is good enough **per gram** (store-brand cookies vs Oreos are within about ±5%), but not per piece, because piece weights vary a lot (tortillas run 22–104 g) and products sharing a name can differ. Change the Food Library's data model now: add a source and source ID, a nullable GTIN (14-digit text) and brand, one calories-per-100 g value (g or ml), and a list of serving sizes with gram weights. Barcode scanning, a bulk branded import and Open Food Facts are deferred.
Findings: `research/packaged-food-databases.md` on branch `research/packaged-food-databases` (commit 90f51fc).
