# Barcode scan on Today

Type: build
Status: open
Assignee:
Blocked by: [Does barcode scanning work inside the Claude app on the phone?](11-barcode-phone-test.md), ["Search USDA" through Supabase](15-search-usda-through-supabase.md)

## What to build

A scan button beside the search box, built on whichever path #11 proved: photo → barcode read in the page → GTIN lookup through #15's function → confirm and log (saved to the Food Library); or, if photos of barcodes fail, a Nutrition Facts label photo read by Claude, typed into the Food Library as a label food.

## Done when

- Scanning a real packaged food logs it with its label calories
- An unknown barcode falls back to search or Estimate with no dead end
