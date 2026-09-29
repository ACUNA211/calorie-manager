# Where do calorie counts come from?

Type: research
Status: resolved
Blocked by:

## Question

When a Member logs food that isn't in the Food Library, the app must search for it and give a calorie estimate. Which sources could supply that? Candidates: USDA FoodData Central, Open Food Facts, Nutritionix, FatSecret, Edamam, and plain LLM estimation from free text (for example "2 eggs and a slice of toast"). For each, compare coverage of generic and branded or restaurant food, free-text search quality, accuracy, pricing and free-tier limits, licence and caching terms, and API ergonomics. Recommend a primary source and a fallback for a two-person app.

## Answer

Primary source: **USDA FoodData Central**. It's free and public domain (so results can be kept in the Food Library for good), has 1,000 requests/hour, and has the strongest generic-food data. Its keyword-only search is covered by having the Agent's LLM split free text into items, quantities and gram weights, then look up each item. Fallback: **an LLM-only estimate**, marked as estimated and editable, for when FDC has no good match (restaurant or home-cooked dishes). Possible later addition: FatSecret Basic (free, 5,000 calls/day) for branded and restaurant gaps, but it limits storage to 24 hours and needs server IPs allow-listed. Ruled out: Nutritionix (public free tier discontinued, $499/month and up), Edamam (paid only, badge required), Open Food Facts (packaged foods only, low rate limits, share-alike licence).

Details and citations: [../research/calorie-data-sources.md](../research/calorie-data-sources.md)
