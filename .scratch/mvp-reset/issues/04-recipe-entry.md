# What does entering a Recipe look like?

Type: prototype
Status: resolved
Assignee:
Blocked by: 

## Question

Mock up creating and editing a Recipe: a name, ingredients picked by Food Library search with amounts (grams, or pieces and cups converted), calories for a branded item typed in once from the label, the total cooked weight, and "makes N servings" as the fallback when it's not weighed. Show calories per gram and per serving as it's built. How is the Recipe list browsed and searched? Can a Recipe be copied and changed? Is anything else needed for planning (for example tagging which Meal Times it suits, or a favourite star)?

## Comments

**Resolution (2026-10-01):** layout **D, A's list with C's editor**, from [the prototype](../prototypes/04-recipe-entry-PROTOTYPE.html?variant=D) (A, B and C are kept in the file for reference).
- **The Recipe list** (from A): one plain list, starred first then by name, with each Recipe's calories per serving and how much it makes. One search box matches Recipe names and ingredient names, and a ★ Starred chip filters. "+ New Recipe" sits above the list.
- **The editor** (from C): name and star, then Meal Time tag chips. A **Recipe Facts** panel, styled like a Nutrition Facts label, shows the serving size, calories per serving (large), per 100 g, per gram and for the whole batch, and updates as you type. Below it is an ingredient table (food, amount with a unit picker, grams when the unit isn't grams, calories, % of the total) under a stacked bar of each ingredient's share, and a raw total.
- **Adding an ingredient:** a search sheet over the Food Library. Its units are the food's serving sizes (piece, cup, tbsp, can, lb…), converted to grams; switching units keeps the grams. "Not here? Type it in from the label" asks for a name, brand, serving size in grams, calories per serving and what the label calls a serving. It's stored per 100 g in the Food Library and marked LABEL.
- **How much it makes:** either **I weigh the cooked food** (cooked weight, plus optional usual servings to suggest a Portion size) or **It makes N servings**. Until it's weighed, the raw weight stands in, with a note. A **Weigh the pot** helper takes the pot with food minus the empty pot (the real app remembers pots).
- **Meal Time tags are a hint:** a Recipe is tagged with the Member's own Meal Times it suits. The Agent prefers tagged Meal Times but can place a Recipe elsewhere when asked. Untagged Recipes can go anywhere.
- **Copying makes a linked variation** ("Make a variation"): the copy shows "Variation of Turkey chili" in the list and editor, but changes never flow between the two.
- **Not added:** cooking steps, prep time and ratings stay out, as charted.
