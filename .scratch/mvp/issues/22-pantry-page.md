# What does the Pantry page look like?

Type: prototype
Status: open
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

Waiting for the Member's reaction.
