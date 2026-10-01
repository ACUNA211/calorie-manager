# What does the Pantry page look like?

Type: prototype
Status: on hold
Assignee: ACUNA211
Blocked by:

## Question

Make a rough mock-up of the Pantry tab (#09) and react to it. #04 set the content: exact amounts for main foods shown as grams plus a kitchen measure ("550 g · about 2¼ cups", "12 eggs · about 600 g"), have / low / out for staples, leftovers as portions with calories per portion, quick-add through the Agent with a confirmation, and direct editing and deleting. How is it grouped (by store section like the Grocery List, by exact vs. staple, or by where it's kept)? How are leftovers shown, and how do they link to the Meal Plan? How is an amount edited quickly, and how is a staple switched between have, low and out? Does it show which planned meals each food is set aside for, or what's missing for this week?

## Comments

**Prototype (2026-10-01):** `prototypes/22-pantry-page-PROTOTYPE.html` (throwaway, also linked from the GitHub Pages index). It has three layouts, switchable with `?variant=A|B|C` or the ← → keys. All three have a **This week / + next week (draft)** switch that changes what counts as set aside and missing.
- **A, store sections:** the same section order as the Grocery List. A "Missing for this week" card sits on top (shrimp on the list, apples not on the list with + Add to list), then the leftovers, then each section. Main foods show grams plus a kitchen measure and a bar: purple is set aside for planned meals, red is short ("1 piece set aside for 1 meal · 2 pieces free"). Staples sit in the same sections with an inline have / low / out switch. Filters: All / Main foods / Staples.
- **B, where it's kept:** Fridge / Freezer / Cupboard / Spice rack tabs (with a count of low or out items), and a row of missing chips. Tiles: a green frame for leftovers (tap to plan), a coloured edge for staples (a tap cycles have → low → out), and 🔒 with the amount set aside on main foods.
- **C, plan first:** "Covered for the rest of this week?" goes meal by meal (✅ all in the Pantry, 🛒 needs something, ⚠️ out or short, + Add to list), then "Leftovers to use", then "Free to use" (only what isn't set aside, with − / + right on the line), then "Set aside" folded away, then staples as one checklist showing only the low and out ones.

Shared in all three:
- **Amount editor:** − / + by a sensible step, "Used ¼ / ½ / all", or type "2 lb", "500 g" or "3 cups" (converted, and pounds of a countable food become a piece count you can correct). It also lists the meals the food is set aside for (read-only: change the meal on the Plan page), Kept in, and Delete with Undo.
- **Leftovers:** portions as dots, calories per portion, where they came from, and "Plan it", which offers Sat lunch / Sat dinner / next Mon lunch / Freeze it. Each option says what it replaces and what it frees: planning the stir-fry for Sat lunch frees the chicken, rice and broccoli the chicken rice bowl had set aside, and Sat dinner takes shrimp off the Grocery List.
- **Adding:** + searches the Pantry or adds a new food (no Agent call). The chat box is the Agent quick-add with a confirmation card ("a dozen eggs and 3 lb chicken breast" → +12 eggs, and "3 lb is about 1,361 g. How many pieces is that?").

Scenario: Fri Oct 2, 4:10pm, the same week as the #21 prototype. Saturday is left this week, and next week's draft isn't approved yet, so its shortfalls (chicken short 1 piece, tortillas short 2) show as "goes on the list when the draft is approved".

**Member's reaction (2026-10-01):** B (where it's kept) is the one. Changes asked for:
- The switch says **Current** / **With Grocery List** instead of this week / next week. With Grocery List counts everything on the list as already bought.
- The where-it's-kept tabs go below that switch.
- Show every food needed for the next 7 days. Yellow if it runs out somewhere in the 7 days, red if it runs out today or tomorrow.

**Prototype, B revised (2026-10-01):** `?variant=B`. Order: Current / With Grocery List → Fridge / Freezer / Cupboard / Spice rack tabs (with a count of short foods, red if any is red) → "Needed in the next 7 days" (Fri Oct 2 – Thu Oct 8) → the tiles for the chosen place.
- The needs card lists every food the next 7 days of meals need. Short ones come first as rows: red (apples for tomorrow's snack, shrimp for tomorrow's tacos), then yellow by the day they run out (chicken short 1 on Sun, cumin out for Sun's curry, tortillas short 2 on Mon, then next week's new foods). Each row says have / need / short, the meal where it runs out, and every meal it's for. The rest are "Covered" chips with "needed of have".
- A food runs out on the first meal where the running total needed is more than what's there, so chicken (3 pieces, 4 needed) is fine tomorrow and yellow from Sun.
- With Grocery List: shrimp (450 g on the list) turns covered, so only apples stay red. "+ Add to list" on a red row puts the shortfall on the list. Yellow rows from next week's draft show "list when draft approved", so they stay yellow in both modes until the draft is approved.
- Tiles use the same red / yellow and show "📅 needed in 7 days · short … from Sun". In With Grocery List, list amounts show as "+450 g from the list", and foods only on the list show as dashed tiles.
- Planning the stir-fry leftover for Sat dinner drops the tacos' needs, and shrimp comes off the list.

**Member's reaction (2026-10-01):** no full list on top. Remove the next-7-days card; a food should show only where it's kept. With Grocery List should show every Grocery List item together with the current Pantry, so it's easy to see if anything could still be missing, and it should subtract the meals already planned.

**Prototype, B revised again (2026-10-01):** the 7-day card is gone. Order: Current / With Grocery List → location tabs (with a count of short foods) → tiles.
- Every food the next 7 days of meals need now has a tile where it's kept, including foods not in the Pantry at all (berries, bell peppers, orzo…). The tile is red if it runs out today or tomorrow, yellow if it runs out later in the 7 days, and short ones sort first.
- **Current:** the real amounts, with "📅 180 g for 2 meals" or "short 1 piece from Sun: Chicken rice bowl".
- **With Grocery List:** the Grocery List now has 5 items (shrimp, olive oil, honey, 6 bananas, 12 cans of sparkling water). Each tile shows what's left over after the planned meals, for example "Eggs: 3 eggs left over · 10 eggs have − 7 eggs planned" and "Shrimp: none left over · + 450 g list − 450 g planned". Items only on the list get a dashed tile, and staples on the list show "+ on list". Shrimp turns covered, so only apples stay red. Next week's shortfalls stay yellow until the draft is approved.
- Planned meals counted: everything through Thu, including next week's draft.

**Member's reaction (2026-10-01):** the chat box should work like adding food (#20): search first, no automatic Agent call. Typing narrows down what's in the Pantry, and picking a food asks whether it's being added or used. Add a recipe builder: build a recipe from the Pantry, with several in progress at once (rice and chicken are two recipes cooked together), and when one is done it goes into the Pantry as a cooked food. Label every food as an ingredient or ready to eat.

**Prototype, round 3 (2026-10-01):** all in `?variant=B`.
- **The box:** live Pantry matches as you type (synonyms, plurals, leftovers and cooked food, foods only needed by the plan), each with its label and how much there is. A leading amount carries over ("2 apples" → 2). "+ New food" adds by hand. Enter opens the top match; only text with no match goes to the Agent, and the hint says so ("Enter asks the Agent ✨ (1 call)").
- **Adding or Using:** picking a food opens two big buttons. Adding: amount stepper or type "2 lb" → "0 → 2 apples". Using: where it's going (Eaten / used up, 🍳 into one of the open recipes, or 🍳 new recipe), with ¼ / ½ / all. Staples: Adding sets have; Using asks have / low / out. Leftovers and cooked food go by portions.
- **Recipe builder (🍳 in the box, or the "🍳 2 cooking" pill in the header):** a tab per recipe in progress (seeded with Rice and Garlic chicken) plus + New. Each recipe has a name, ingredients from a Pantry search (Ingredients first) with steppers, rough calories, "have 3 pieces · 2 in Garlic chicken", and a warning when the open recipes use more than there is. Nothing leaves the Pantry until it's cooked; tiles show "🍳 150 g in Rice" meanwhile. Keep for later or Discard.
- **Done cooking:** shows what comes out of the Pantry (staples stay as they are), asks how many portions (calories per portion worked out), the label (Ready to eat, or Ingredient for things like plain rice for bowls), and where it's kept. It then appears as a 🍳 cooked-food tile next to the leftovers.
- **Labels:** 🥕 Ingredient / 🍽 Ready to eat on every tile and match, a filter under the location tabs, and a switch in the food's sheet.
- Open question: CONTEXT.md avoids "recipe" (recipes with steps are a future phase) and uses Dish for a named meal with ingredients. This builder has no steps, so is it a Dish being made, or a new term?

**Member's reaction (2026-10-01):** tapping something in the Pantry should give two options, eat now and schedule for later. Schedule for later offers a few meals, and if none of those fit, a "Select another" button where a date can be picked.

**Prototype, round 4 (2026-10-01):** tapping a food tile (or picking it from the box) opens one sheet with **🍽 Eat now** and **📅 Schedule for later** on top, and **+ Adding** / **− Using** under them. Staples only get Adding / Using. "Edit details" (amount, where it's kept, delete) is a link at the bottom.
- **Eat now:** amount (with calories), "Log as" breakfast / lunch / snack / dinner (preset from the time of day, snack at 4:10pm), then "Eat now · 73 kcal as snack". It goes into Today's Calorie Log and comes out of the Pantry, with no Agent call.
- **Schedule for later:** amount, then four upcoming meals (tonight's dinner, tomorrow's lunch, snack and dinner), each showing what's planned there. **📅 Select another** opens a date picker and a meal (breakfast / lunch / snack / dinner). Past meals are refused. Dates past next week show "not planned yet, kept for that meal when the week is planned".
- When the meal already has something planned: **Replace it** or **Add alongside it**. Replace is preset for leftovers, cooked food, and Ready-to-eat food of 300 kcal or more. Replacing frees what the old meal needed (chili for Sat lunch frees the chicken rice bowl's chicken, rice and broccoli), and the meal option then shows the new food.
- The tile shows "📅 100 g Wed, Oct 14 · snack". A scheduled main food counts as planned in With Grocery List.

**Member's reaction (2026-10-01):** this isn't converging, so split it up and work on one thing at a time. Remove the location tabs and make it a list like C's "Free to use", with no −/+ on the rows and the quantity in pieces/grams or cups/mL. Foods can be tagged Ready to eat, Ingredient, or both (apples). Tapping a food should give: a typed quantity with a unit toggle and a green + / red −; for ingredients, Add to a recipe (current recipes or a new one, which asks for its name); for ready-to-eat food, Eat (same unit options, next meal of the day) and Schedule (suggested replace/add meals, or placing it yourself on the plan). Everything else stays. Also wanted: a cooking page, planned cooking, and a recipe database.

**Split (2026-10-01):** cooking and recipes move out of this ticket. [#27](27-cooking-page.md) covers the Cooking page and planned cooks, and starts from this prototype's recipe builder. [#28](28-dish-database.md) covers the Dish database and the Dish vs. recipe naming. #22 keeps the Pantry list and what happens when a food is tapped. Its "Add to a recipe" just hands off to #27.

**Prototype, round 5 (2026-10-01):** all in `?variant=B`.
- **List, no tabs:** Current / With Grocery List, the tag filter, then three lists: Leftovers & cooked, Foods and Staples. Short foods sort first, with the same red / yellow rows. Each row shows its tags, need line, 🍳 recipe line and 📅 schedule line, with the quantity on the right. A **pcs / cups ⇄ g / mL** switch on Foods changes every quantity ("9¾ cups" ⇄ "1,800 g"). Staples keep have / low / out on the row.
- **Tags:** 🥕 Ingredient, 🍽 Ready to eat, or both (apples, bananas, yogurt, bread, cheddar, carrots). The filter counts a food with both tags under each. The sheet has a two-button tag toggle that won't let you remove both.
- **Tapping a food** opens one sheet. The amount typed under Quantity is used by every action:
  - **Quantity:** a big field, a red − and a green + on either side, and a pieces ⇄ grams (or cups ⇄ grams / mL) toggle that converts what's typed. "2 lb" also works. A live line shows "= 5 apples · 910 g · 473 kcal".
  - **🍳 Add to a recipe** (ingredients only): a button per open recipe, plus **+ New recipe**, which asks for a name before it starts.
  - **🍽 Eat** (ready to eat only): today's remaining meals, snack (now) and dinner (next), then "Eat as snack · 110 kcal".
  - **📅 Schedule it** (ready to eat only): four suggested meals, each marked replace / add alongside / free; **Select another** (date + meal); and **🗓 Put it on the map myself**, a Today–Thu × meals grid of what's planned where you tap a cell (past meals greyed, draft days yellow). Then you pick Replace or Add alongside and Schedule.
  - Staples get have / low / out and Add to a recipe. Edit details (where it's kept, delete) is still a link.

**On hold (2026-10-01):** the Member has a lot of issues with this ticket and wants to plan things better before going on. Round 5 stays as the latest prototype. Pick it up again from the Member's notes.
