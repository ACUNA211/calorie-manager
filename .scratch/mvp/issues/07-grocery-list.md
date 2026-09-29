# How is the Grocery List built?

Type: grilling
Status: resolved
Blocked by: 04, 06

## Question

When and how is the Grocery List for the upcoming week produced: automatically from the Meal Plan's Missing Ingredients, plus which Agent recommendations (staples running low, cheaper swaps)? Can both Members edit it and tick items off while shopping? When bought items are ticked, do they move into the Pantry, and in what units?

## Comments

**Input from #05 (2026-09-27):** The Grocery List is **always live**, not rebuilt each week. Chat and manual adds go straight on, labelled as the Member's with the date. Approving a Meal Plan merges in its Missing Ingredients plus the Agent's suggestions (unticked by default). The Member may shop more than once a week. An unbought-ingredient alert fires at 3pm the day before a meal that needs an unticked item. If the item is still missing on the day, the Agent proposes a swap from the Pantry. The weekly reflection asks about items the Member added.

**Input from #06 (2026-09-27):** The plan week runs Monday to Sunday and is approved after the Friday reflection, so the Grocery List fills in over the weekend. Mid-week plan changes update the list: new Missing Ingredients are added, and Agent-added items no longer needed are removed if unticked. Member-added items are never removed. Replacements favour the Pantry, and a store trip is the last resort.

## Answer

- **Agent suggestions:** staples marked **low** or **out** in the Pantry, and items the Member usually buys that seem to be running out (from past lists and the Calorie Log). Each has a short reason ("Olive oil: marked low") and goes on unticked. No cheaper swaps (they need budget tracking, phase 3 or 4) and no extra snack cover (that belongs in the Meal Plan).
- **Measures:** one measure per food, chosen by the Agent when the food first enters the Food Library. The Member can change it once and it's remembered.
  - Countable foods: pieces ("Chicken breast: week needs 2 pieces")
  - Scoopable foods: cups plus grams ("Rice: need 2 cups")
  - Liquids: cups plus milliliters
  - Anything else (minced meat, cheese): grams

  The amount is the shortfall against the Pantry, with pieces rounded up to whole pieces. Any extra goes into the Pantry and is used first by the next plan.
- **Combining lines:** an ingredient needed by several meals is one line with the combined amount and a tap-to-expand "for: Tue dinner, Thu lunch". The unbought-ingredient alert goes by the earliest meal. Items a Member adds merge into the same line but keep their label, so they're never removed automatically. Lines are combined only when neither has been crossed off.
- **Order:** by store section: produce, meat and fish, dairy and eggs, bakery, dry goods and staples, frozen, other. Items needed within the next two days get a "needed Tue" tag.
- **Non-food items:** free text under "Other" (paper towels, dish soap). They never go into the Pantry, have no calories, and the Agent doesn't suggest them.
- **Ticking an item:**
  - Crossing it off records the required amount as bought.
  - The Member can then edit the amount, more or less, in grams, pieces or milliliters ("920 g", "5 pieces"). The Pantry gets whatever was entered.
  - Staples (have / low / out) are simply set to **have**.
  - If less was bought than needed, the line stays crossed off at what was bought, and a new line for the remainder, with its required amount, appears automatically.
  - The Member can also add another line for the same item at any time, for example when buying more at a second store.
- **Crossed-off items:** stay in place, crossed out, and leave the list at midnight. The Activity Log keeps the record.
- **Offline and sharing:** ticking works offline and syncs when the phone is back online. There is one Household list, updated live on both phones once the second Member joins (phase 3). This adds **offline sync** to the tech-stack question.
- **Chat from the list:** the Grocery List screen opens chat with the Agent. If the Member can't find an item ("I can't find this, can we substitute it?"), the Agent proposes either a substitute ("I'll remove X and add Y", updating the affected Dish) or a change to this week's Meal Plan. It applies only on the Member's yes, with undo.
- **Activity Log:** every item the Agent adds to or removes from the list is logged with undo. A plan merge is one entry ("Added 9 items from next week's plan"), and each automatic removal gets its own entry.
- **Kitchen Tools (MVP):**
  - A one-time checklist of the tools the Household owns (oven, air fryer, blender, rice cooker…), updated through chat ("I bought an air fryer") or on the page.
  - Each Dish lists the tools it needs.
  - The Agent never puts a Dish that needs a missing tool into the Meal Plan. It may mention it as an idea ("If you had an air fryer, you could make…"), and it adds the tool to the Grocery List under "Other" only when the Member asks.
