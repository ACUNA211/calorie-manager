# Food Library, Recipes and /add-recipe-cal

Type: build
Status: open
Assignee:
Blocked by: [Artifact shell and the Meal Times tab](12-artifact-shell-and-meal-times.md)

## What to build

Tables: Food Library foods (source: usda / label / estimated, source ID, nullable GTIN and brand, kcal per 100 g, serving sizes in g) and Recipes with ingredients (food + amount), yield (cooked weight or "makes N servings"), starred, Meal Time tags, and a link to the original for copies. The `/add-recipe-cal` skill: the Member says or dictates a Recipe; the Agent looks each ingredient up in USDA FoodData Central, shows each one's calorie share for a yes, then saves it; it also edits, copies and deletes Recipes on request. The Recipes tab: searchable list (starred first, cal/serving), star toggle, read-only Recipe view.

## Done when

- `/add-recipe-cal` saves a real Recipe end to end and the Recipes tab shows it with the right cal/serving
- Starring in the app persists
- A copied Recipe names its original and doesn't change with it

## Notes

Uses the Food Library model from #01's research. Supersedes #04's in-app editor.
