# What does a Rebalance conversation look like?

Type: prototype
Status: resolved
Assignee:
Blocked by: [What does planning the week look like?](05-plan-page.md), [What do Today and logging look like?](07-today-and-logging.md)

## Question

Mock up Rebalance as a command: you type "lunch went 400 over" or press Rebalance, and the Agent proposes changes. By default it only changes the rest of today (smaller Portions, dropping an If room time, swapping in a Portion from a Cook already planned this week). If asked, it spreads the overage over the rest of the week. It never touches Set times or takes a Planned time below its range. From #06: moving or resizing Portions never changes the shopping list; if it wants a Cook to make more servings, accepting it raises the shopping list's Review (#06). Nothing changes until approved. How are the options and their effect on the day and week shown? What does accepting look like?

## Comments

**Resolution (2026-10-01):** layout **D, option cards with a chat card**, from [the prototype](../prototypes/08-rebalance-PROTOTYPE.html?variant=D) (A, B and C are kept in the file for reference).
- **Opening it:** the ⚖ Rebalance button on Today (#07), red with "N over" when the day is heading over, or typing "lunch went 400 over" in Today's box, which logs the extra to that Meal Time locally and opens Rebalance.
- **The sheet:** says where today is heading and by how much, then a **Rest of today / + Rest of the week** switch.
- **Option cards (no AI):** up to three, worked out on the phone by rules: shrink an unlogged Planned Portion in ¼ servings while it stays in its Meal Time's range, or drop an unlogged If room time. Set times and logged meals are never touched. Options that land in the aim come first, then fewer changes, then the smallest cut. Each card lists its changes ("Dinner: 1½ → 1¼ servings of Chicken rice bowl, −128") and a before/after bar, with **Use this**. The first is marked "Smallest fix".
- **When today can't be fixed:** the card says today still counts as over whatever happens, and points to the rest of the week.
- **+ Rest of the week:** takes what today can't (or the whole overage, if you'd rather leave today alone) from the later days. Each day takes its share with its smallest change that covers it; days already under the aim are left alone, and a day may end under the aim. A week strip shows each day before → after.
- **The last card, "Talk it through with the Agent"** (AI, one call a reply), is for anything the cards don't cover. Its chips ("Keep the snack", "Take it from Friday", "Spread it over the week") or typing open the chat, with "‹ Options" to go back. The Agent follows the same rules, proposes with the same changes list and bar, and waits for Approve.
- **Approving:** changes the Meal Plan (Portion sizes, dropped If room times), outlines the changed meals in orange on Today and the Plan page, and shows an Undo toast. It never changes Cooks' servings made, so the shopping list stays as it is (#06).
- **Cost:** a Rebalance costs no AI unless the chat card is used.
