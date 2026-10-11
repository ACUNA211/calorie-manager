# "Search USDA" through Supabase

Type: build
Status: open
Assignee:
Blocked by: [Today: log food by search](14-today-logging-by-search.md)

## What to build

Turn on Supabase's `http` extension and add a database function that searches USDA FoodData Central (and looks up a GTIN) with a free data.gov key kept in Supabase Vault. On Today, when the Member taps "Search USDA" under the local results, show USDA matches (Branded included); picking one saves it to the Food Library and logs it.

## Done when

- A food not in the Food Library can be found and logged from Today
- It's saved, so the next search finds it locally
- The API key never appears in the artifact

## Notes

USDA allows 1,000 requests/hour per key; search only on tap, not as you type. Run #01's kcal sanity check (4·carb + 4·protein + 9·fat) when saving branded items.
