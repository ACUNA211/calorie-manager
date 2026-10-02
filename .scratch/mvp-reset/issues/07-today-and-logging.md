# What do Today and logging look like?

Type: prototype
Status: resolved
Assignee:
Blocked by: [Which of the old map's decisions carry over?](02-carry-over-old-decisions.md), [What does setting up Meal Times look like?](03-meal-times-settings.md)

## Question

Rework the old [How does food get into the Calorie Log?](../../mvp/issues/20-adding-food.md) for this map: Today lists the day's Meal Times with what's planned at each, and each one gets a one-tap ✓ Ate as planned (½ / ¾ / 1¼). Set Meal Times log their set calories in one tap. Anything else is a search across Recipes and the Food Library, with an amount in grams or servings, and a single AI estimate only when nothing matches (skippable, typing calories by hand). Food can also be logged at a custom time. Show calories left against the target and band. Where does the Rebalance command sit?

## Comments

**Resolution (2026-10-01):** layout **B, next meal first**, from [the prototype](../prototypes/07-today-logging-PROTOTYPE.html?variant=B) (A and C are kept in the file for reference).
- **Header:** the date in the middle ("Tuesday, Oct 6", with "Today · 12:40pm", "Yesterday", "Tomorrow" and so on under it) and ‹ › arrows either side to page through the days. Away from today there's a "back to today" link.
- **Counter:** calories left against the Calorie Target, with the aim under it, and a bar: eaten solid, still planned hatched, the aim shaded and the target as a red line. Under it: "If the rest goes as planned, today lands at …", in or under the aim or over.
- **Rebalance** is a ⚖ button beside the counter, on today only. It turns red with "N over" when the day is heading over the target.
- **Confirm card:** the meal that's due (now, not logged yet, or up next). A Planned meal gets **✓ Ate as planned**, **½ / ¾ / 1¼** and **Something else**; a Set meal gets **✓ 900 as set** and **Different amount** (type it, e.g. the work lunch at 1,150). An If room time with nothing planned says how much room is left and has **+ Add**. Then a compact table of the rest of the day, with a one-tap ✓ on each row.
- **The box** at the bottom logs anything else. It searches Recipes and the Food Library locally (synonyms, small typos, plurals, amounts like "150g", "4 oz", "2 eggs", "1.5 servings") and splits text on "and", "with" and commas. Matches show as you type; a hint says whether Enter needs AI. A part nothing matches offers **Estimate with AI (1 call)** (marked est.), **Type calories** or **Drop**.
- **Confirm card for the box:** each item with its amount and unit (servings or grams for a weighed Recipe, the food's serving sizes or grams), the Meal Time it goes to (from the clock, changeable) or **Other time…** with a time, then Log. An Undo toast follows every log.
- **Fixing a log:** tap anything logged to change its amount or Meal Time, or delete it, with Undo.
- **Past days:** show where the day ended; a planned meal that wasn't logged says "not logged" and can be caught up; until then its calories aren't counted (how the Week view treats that day is #09's question). The box logs to that day.
- **Future days:** the plan and where it lands, read-only, with a pointer to the Plan page. No logging ahead.
