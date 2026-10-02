# What does cooking look like: a Cooking page and planned cooks?

Type: prototype
Status: superseded
Assignee: ACUNA211
Blocked by: [#28](28-dish-database.md)

## Question

Split out of #22 (2026-10-01). The Pantry prototype grew a recipe builder: several cooks in progress at once (rice and garlic chicken cooked together), ingredients picked from the Pantry, and "Done cooking", which subtracts the ingredients and adds the result to the Pantry as cooked food in portions, with calories per portion. The Member wants this as its own **Cooking page**, plus **planned cooking**: cooks scheduled ahead for the meals they feed, checked against the Pantry.

Today the spec only has the pieces. #04 says that marking a planned meal cooked subtracts its ingredients and that leftovers go back as portions. #06 and #21 have the weekend Prep Session and "cook once, eat several times" batches on the Plan page. Nothing says where cooking actually happens.

Open questions:
- **Where it lives:** a tab, a page under ☰, or reached from Plan, Pantry and Today?
- **What it shows:** today's planned cooks from the Meal Plan (a Dish × the Portions plus planned leftovers), the next Prep Session, and cooks in progress.
- **Scheduling a cook:** for which meals, and how it reserves Pantry amounts and adds missing ones to the Grocery List.
- **Done cooking:** the portions, the Ingredient / Ready to eat tag, and where the cooked food is kept.
- **Unplanned cooks:** how one made from whatever is in the Pantry becomes a Dish (#28).
- **#20 overlap:** how this fits with ✓ Ate as planned on Today.

Starting point: the recipe builder in `prototypes/22-pantry-page-PROTOTYPE.html` (`recipeSheet`, `doneSheet`, `rCook`).

## Comments

**Superseded (2026-10-01):** the MVP was re-charted as a smaller map: [Calorie Manager MVP (reset)](../../mvp-reset/map.md). Kept for reference.
