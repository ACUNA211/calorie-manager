# 67: MyPlate Kitchen import

**What to build:** Import a starter set of Recipes from USDA MyPlate Kitchen into the Household library: ingredients matched to USDA foods in grams, nutrition from those foods. Collect politely (respect robots.txt, slow rate), check the recipes' public-domain status first, and credit the source on each imported Recipe.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 28 (Recipes page)

**Status:** ready-for-agent

- [ ] A one-off script imports at least 50 Recipes with matched ingredients
- [ ] Each imported Recipe credits MyPlate Kitchen and links to the original
- [ ] Ingredients that couldn't be matched are listed for review, not guessed
- [ ] Public-domain status is noted in the ticket's comments with a source
