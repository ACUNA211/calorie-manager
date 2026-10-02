# What does planning the week look like?

Type: prototype
Status: resolved
Assignee:
Blocked by: [What does setting up Meal Times look like?](03-meal-times-settings.md), [What does entering a Recipe look like?](04-recipe-entry.md)

## Question

Mock up the Plan page: the planning chat next to a Sunday-to-Saturday grid of Meal Times. The Agent drafts from Recipes, Meal Times, the Calorie Target and band, use-up notes ("use the spinach by Monday") and how last week went. Set times are set aside first, then Planned, then If room filled with anything while calories remain. A Cook places Portions at several Meal Times, so how is a Cook shown, and how are its Portions moved, resized or removed on the grid? How are the day totals against the band shown? What does Approve do (it builds the shopping list)? What does changing an approved plan look like? The chat starts fresh each week and can't invent Recipes. Recipes carry Meal Time tags as a hint and a star (#04): how do these show up when the Agent drafts, and when you swap a Recipe on the grid?

## Comments

**Resolution (2026-10-01):** layout **B, the grid with a chat drawer**, from [the prototype](../prototypes/05-plan-page-PROTOTYPE.html?variant=B) (A and C are kept in the file for reference).
- **The page:** the week grid fills it, with rows for Meal Times and columns Sunday to Saturday, matching the Meal Times page (#03). A toolbar holds the status (Not drafted / Draft / Approved), Undo, Approve and "N/7 in aim".
- **Cells:** Set cells show their held calories and aren't editable here. An empty Planned cell is dashed red ("fill"). An empty If room cell says "room" while the day has space, otherwise "–". A filled cell shows the Recipe and its calories, in red if outside the Meal Time's range.
- **Cooks:** each Cook that feeds more than one meal gets its own colour (tinted cell, stripe on the left), and 🔥 marks the day it's cooked. One-off Cooks are grey. Under the grid, a Cooks list shows each one's cook day, meals, and servings placed against made (spare or short). Tap a Cook to highlight its meals and fade the rest; tap again to edit it.
- **Editing a Cook:** change its cook day and how many servings it makes (the shopping list scales to that). It warns when Portions need more servings than it makes, or come before the cook day.
- **Tap a meal:** resize it in servings (½ to 2, with calories, grams when the Recipe is weighed, the Meal Time's range and the day total). Move it to another cell (if the spot is taken, the two swap; moving it before the cook day moves the cook day). Swap the Recipe, or remove it. Tapping an empty cell opens the same picker.
- **The picker:** Cooks already planned with servings spare (no extra shopping), then Recipes tagged for that Meal Time, starred first, then "Other Recipes (not tagged, still fine)". A new Recipe becomes a new Cook that day. A Recipe placed somewhere it isn't tagged for gets a note saying the tag is only a hint.
- **Day totals:** under each column, the total (green in the aim, amber under it, red over the target) and a bar with the aim shaded green and the target as a red line.
- **The chat:** a drawer at the bottom that collapses to one line with the Agent's last message and an input. It is open before the draft and closes when the draft arrives. Each week starts a fresh chat with how last week went, and asks what to use up or plan around. The Agent drafts Set first, then Planned, then If room. It sticks to tags, prefers starred Recipes, and says which days miss the aim. What you ask for happens straight away with Undo; what it suggests (such as fixing a day under the aim) waits for a yes. It can't invent Recipes: it says so and points to the Recipes page.
- **Approve** builds the shopping list (one line per food, scaled to each Cook's servings made). The plan stays editable afterwards.
- **After approval:** changed meals get an orange outline. A bar shows when the shopping list no longer matches the plan, and Review lists what would be added, changed or removed before "Update shopping list". Resizing a Portion doesn't change the list; only adding or removing a Cook or changing its servings made does.
