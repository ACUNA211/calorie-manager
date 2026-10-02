# What does the Grocery page look like in the store?

Type: prototype
Status: superseded
Assignee: ACUNA211
Blocked by:

## Question

Make a rough mock-up of the Grocery tab (#09) and react to it, as it's used one-handed in a store. #07 set almost everything: one measure per food showing the shortfall, lines ordered by store section, combined lines with a tap-to-expand "for: Tue dinner, Thu lunch", "needed Tue" tags, the Agent's suggestion lines unticked with a reason, ticking at the required amount and then editing it, an automatic remainder line after a shortfall, crossed-off items clearing at midnight, an Other section for non-food, and chat from the list for substitutes. What's left is the interaction. How does ticking and then correcting the amount work without slowing shopping down? How are the Agent's suggestions told apart from needed items, and accepted or dismissed? How does the page show it's offline, and that ticks are waiting to sync? Where does the chat entry point sit? How are items the Member added themselves shown with their label?

## Comments

**Prototype (2026-10-01):** `prototypes/23-grocery-page-PROTOTYPE.html` (throwaway, also linked from the GitHub Pages index). It has three layouts, switchable with `?variant=A|B|C` or the ← → keys, and an **📶 Online / ✈ Offline** button on the floating bar. Offline, ticks are saved with ⏳ "not synced", the banner says "Offline · 2 ticks waiting to sync", and going back online syncs them.
- **A, checklist:** one list by store section with big tick circles. A ticked line is crossed out and shows "got 2 tortillas ✎" on the right. Tapping that opens a stepper inside the line (extra goes into the Pantry, less adds a remainder line). The Agent's suggestions sit in their own aisle with a dashed purple border, a reason and Add / ✕, and they aren't on the list until added. Chat is a floating 💬 button, plus "Can't find it?" on each line.
- **B, one aisle at a time:** a progress bar of aisles, huge rows where a tap anywhere ticks, ticked lines drop to the bottom with − / + under the thumb, and big ‹ Previous / Next: Meat & fish › buttons in the thumb zone. The Agent's suggestions come last, as a "Before you check out" step with Skip / Got it ✓.
- **C, to buy / in the cart:** a tick moves the line into a dark cart tray at the bottom. Amounts are checked once at the end on a "Check amounts" screen, where remainder lines are made. Suggestions are a chip row at the top (+ / ✕). Chat is an "Ask the Agent" box above the cart.

Shared: one measure per food ("2 cups · about 300 g" berries, "1⅔ cups · 400 mL" coconut milk, "2 tortillas", "450 g" shrimp), combined lines ("for 2 meals ▾"), "needed today" / "needed Sun" tags, lines you added ("added by you", or "+4 added by you · for the week" merged into the plan's apples), staples set to have when ticked, an Other section, and substitutes from chat ("I can't find orzo" → buy small pasta shells instead, or change Thu dinner), applied only on a tap, with Undo.

Scenario: Sat Oct 3, 10:20am in the store, the same week as the #21 prototype. Next week's plan was approved on Friday, so its Missing Ingredients are on the list, plus shrimp for tonight's tacos.

Waiting for the Member's reaction.

**Superseded (2026-10-01):** the MVP was re-charted as a smaller map: [Calorie Manager MVP (reset)](../../mvp-reset/map.md). Kept for reference.
