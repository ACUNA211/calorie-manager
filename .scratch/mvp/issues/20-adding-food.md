# How does food get into the Calorie Log?

Type: prototype
Status: open
Assignee: ACUNA211
Blocked by:

## Question

Make a rough mock-up of logging food and react to it. #02 set how "2 eggs and toast" becomes items with calories (the LLM splits it, FoodData Central looks each item up, and an LLM estimate is marked as estimated). #09 put a + quick-entry button next to the Agent chat box. #04 subtracts food from the Pantry only after the Member confirms it came from there. What does the confirmation look like before the food lands in the Calorie Log: a card with each item, its grams and calories, and which meal slot it goes in? Is the + button the same flow as chat or a separate form? How does a Member fix a wrong match or amount, both before confirming and after it's logged? How is an estimated item shown, and can it be swapped for a Food Library match? How do eating out, a planned meal eaten "as planned", and food logged for the other Member (#13) fit in?

Cost angle (#17): chat food logging is the biggest AI job (~28%), and ~55% of the AI bill is the uncached start of each Agent turn. Can a Member log straight from a Food Library search with no Agent call at all, with the Agent only used for free text or foods the library doesn't have yet? How good does the search need to be (typos, synonyms like "eggs" vs "egg, whole, raw", recent and frequent foods first, Dishes as well as single foods) for that to be the default path?

## Comments

**Prototype (2026-10-01):** `prototypes/20-adding-food-PROTOTYPE.html` (throwaway, also linked from the GitHub Pages index). It has three layouts, switchable with `?variant=A|B|C` or the ← → keys. All three share the same Food Library search: synonyms ("eggs" → Egg, whole, cooked; "pb"; "yoghurt"), typos ("brocoli"), amounts typed in ("150g chicken", "4 oz almonds" → 113 g), recent and frequent foods first, and Dishes mixed in with single foods. A "Prototype state" box counts Agent calls against logs that needed none.
- **A, + opens a search sheet:** the meal slot at the top (Lunch, from the time), the planned meal with ✓ Ate as planned and ½ / ¾ / 1¼ portion, then search. Tapping a result adds it to a tray, and the tray is the confirmation card: each item with its amount stepper, calories, "Wrong match?" and a Pantry tick, plus a Log button. "Ask the Agent" at the bottom of the results is the only way to spend an Agent call. The chat box is a separate flow that ends in the same card.
- **B, one box:** no separate + form. Typing shows live library matches above the keyboard (⚡ no Agent call), with a hint saying whether Enter stays local. Enter logs locally when every part of the text matches the library, and only calls the Agent when something doesn't ("chipotle burrito bowl with guac"). Everything lands as a card in a chat stream, and the planned meal is asked about with a template line (no Agent call).
- **C, meal rows:** Today's table is where you log. Each meal has As planned / ½ / ¾ / 1¼ / Something else. The search opens inside the row, and a tap logs straight away with Undo (no confirmation card). The Pantry question ("From the Pantry? Yes, subtract / No") comes after, on the logged food. Only the Agent's reading of free text waits for a confirm.

In every layout, a logged food can be changed by tapping it in Today: amount, meal, wrong match (near matches plus a search), swapping an orange "est." item for a library food, "It wasn't from the Pantry", and Delete, all with Undo. Eating Out (tonight's Pizza night, aim 800) can be logged at its aim or described, and the card says which occasion this is before the aim is learned. A For: You / Ana switch on the card shows logging for the other Member (phase 3, #13).

Scenario: Fri Oct 2, 12:40pm, the same week as the #21 prototype. Breakfast is logged as planned, lunch is a leftover Beef stir-fry, dinner is Pizza night.

Waiting for the Member's reaction.

**Feedback round 1 (2026-10-01):** **B (one box, library first) is the direction**, but the home screen needs a button to confirm the planned food without going through chat. B is now the default and has two tabs:
- **Today** is the dashboard (#09): the calories-left counter, then a **confirm card** for the first unlogged meal ("Lunch · now · 12:40: Planned: Beef stir-fry ↺ leftover, 480") with **✓ Ate as planned**, ½ / ¾ / 1¼ portion and Something else (which focuses the box). For Eating Out it's **Log the aim (800)**. After logging, the card moves on to the next meal ("Dinner · up next"), or a missed earlier meal shows as "not logged yet". Every other unlogged meal in the table has its own one-tap ✓ Ate as planned / Log the aim. All of this is local, with no Agent call. Cards from the box (library or Agent) appear on Today above the table, so you confirm them where you are.
- **Chat** keeps the same cards as a stream, and confirming the planned meal on Today adds a "✓ Lunch logged as planned" line there.
