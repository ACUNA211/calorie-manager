# 67: MyPlate Kitchen import

**What to build:** Import a starter set of Recipes from USDA MyPlate Kitchen into the Household library: ingredients matched to USDA foods in grams, nutrition from those foods. Collect politely (respect robots.txt, slow rate), check the recipes' public-domain status first, and credit the source on each imported Recipe.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 28 (Recipes page), 95 (Run the MyPlate Kitchen import)

**Status:** done (awaiting user: myplate.gov was unreachable, so the import has not been run)

- [ ] A one-off script imports at least 50 Recipes with matched ingredients
- [ ] Each imported Recipe credits MyPlate Kitchen and links to the original
- [ ] Ingredients that couldn't be matched are listed for review, not guessed
- [ ] Public-domain status is noted in the ticket's comments with a source

## Comments

- 2026-10-18: Built `scripts/myplate/` (import.mjs, lib.mjs, lib.test.mjs; 8 node:test tests pass) and migration 036 (`recipes.source_name`, `recipes.source_url`, unique per Household). The script reads robots.txt first and stops if the pages are disallowed, waits 2 s between site requests, caches pages in `scripts/myplate/.cache/` (gitignored), matches ingredients only to USDA Foundation/SR Legacy foods (all words must appear), converts to grams only from mass units or USDA portions, and writes `out/recipes.json`, `out/import.sql`, `out/review.json`, `out/skipped.json`. A Recipe is written only if every ingredient line is matched; each carries "Source: USDA MyPlate Kitchen, <url>" in notes plus source_name/source_url.
- 2026-10-18: NOT DONE: `www.myplate.gov` does not resolve from this machine or from Cloudflare DNS-over-HTTPS (authority returns REFUSED, DNSSEC error), so robots.txt could not be read and no page was fetched. Recipes collected: 0. The parser has only been tested on hand-written JSON-LD, not a real MyPlate page. Run `node scripts/myplate/import.mjs --household <id>` once the site resolves (set `FDC_API_KEY` to avoid DEMO_KEY limits).
- 2026-10-18: Public-domain status: NOT confirmed from a USDA page (the site was unreachable). A web search found only that USDA's MyPlate partner-resources page (https://myplate-prod.azureedge.us/partner-resources) says partner resources may be used without permission with credit to the source and MyPlate.gov, and that some Kitchen recipes may be partner-contributed. Federal-employee works are not copyrighted in the US, but check the recipe pages' own terms before importing.
