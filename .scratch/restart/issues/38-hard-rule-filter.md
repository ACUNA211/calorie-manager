# 38: Hard-rule filter

**What to build:** A tested server function: given a set of Members (everyone eating at a Meal Time), return the Recipes none of their Hard rules forbid. A Recipe is forbidden if any ingredient matches a forbidden food or group, or breaks a diet rule.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 37 (Preferences page), 28 (Recipes page), 98 (Run the database tests for migrations 035 onward), 100 (Decide: how Hard rules map foods to groups and diets)

**Status:** done (awaiting you to run the database tests with `supabase test db` on a local stack, push migration 040, and decide the mapping questions in the Comments)

- [x] Unit tests cover an allergy, a food someone won't eat, vegetarian and halal (pgTAP scenarios written, NOT run: no local stack; the keyword rules were only checked with a JavaScript port of the patterns, not in Postgres)
- [x] A Recipe with one forbidden ingredient is excluded for that whole group (pgTAP scenario, NOT run)
- [x] Members with no Hard rules get every Recipe (pgTAP scenario, NOT run)

## Comments

- 2026-10-19: Built migration 040 (`public.allowed_recipes(member_ids)` returns the Recipes nobody's Hard rules forbid; `public.hard_rule_breaks(member_ids)` lists each break with Recipe, Member, rule and ingredient, for the validator in 41) and `supabase/tests/hard_rule_filter_test.sql` (19 assertions, NOT run: no local stack). No JS module or UI: nothing in the client needs it. Mapping approach: the Food Library only has name, Spanish name and USDA category, so each food gets tags from keyword rules (table `private.food_tag_rules`, word matches on both names, accent-insensitive, with phrases cut out such as peanut butter or coconut milk, plus category rules like 'Dairy and Egg Products'). Each group and diet rule is a list of tags (`private.hard_rules`). A Member's foods list matches ingredient names as whole words, singular or plural. Conservative: unknown-species meat (sausage, broth, meat) and unknown seafood are tagged so the meat groups, vegetarian, vegan, pescatarian, halal, kosher exclude them. Foods matching no keyword are never blocked, and hidden ingredients (soy lecithin, wheat in a branded sauce) are not caught. Only the household's Members, only its Recipes; Recipes with no ingredients are allowed. Decisions for you: coconut is not a tree nut; oats count as gluten; halal blocks pork, alcohol, gelatin and unknown meat but cannot check slaughter; kosher also blocks meat with dairy in one Recipe; vegetarian allows eggs, dairy and honey. Change them in `private.hard_rules` / the rule rows if you disagree.
