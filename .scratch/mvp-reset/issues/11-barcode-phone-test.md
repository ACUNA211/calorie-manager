# Does barcode scanning work inside the Claude app on the phone?

Type: spike
Status: open
Assignee:
Blocked by: None

## What to build

A throwaway test artifact opened on the Member's phone in the Claude app. Three checks, each showing pass/fail on screen: (1) a "take photo" file input (`accept="image/*" capture`) opens the camera and returns an image; (2) a barcode-reading library loaded from an allowed CDN reads a UPC from that photo; (3) the UPC is looked up in USDA FoodData Central through Supabase (the `http` extension, see #15's approach) and returns a product name and kcal/100 g. Also test (4): sending a Nutrition Facts label photo to Claude from the page and getting calories and serving size back.

## Done when

- Each of the four checks has a recorded pass/fail from a real phone run
- The result is written into this ticket and decides #17's path (barcode, or label photo fallback)

## Notes

Live camera access isn't among this account's artifact capabilities; a photo file input usually works in web pages but is unverified inside the Claude app. Delete the test artifact afterwards.

## Comments

Built 2026-10-10: the throwaway test page is the Barcode Phone Test artifact (`app/barcode-test.html`). **Waiting on Sergio** to run it on his phone and send the summary.
