# How is a Meal Plan built?

Type: grilling
Status: resolved
Blocked by: 03, 04

## Question

What is the structure of a week's Meal Plan: which meal slots (breakfast, lunch, dinner, snacks), which day the week starts, and which meals are shared vs. individual? When is the Agent's draft made, and how do Members edit it? How are Portions sized to each Member's Calorie Target? How far should the plan favour food already in the Pantry, and how do Missing Ingredients show up in it?

## Comments

**Input from #05 (2026-09-27):** The draft is made after the Friday 3pm reflection (default; the Schedule is editable) and approved whenever the Member is ready. It is never approved automatically, and there's one reminder at 7pm. Default meal slots are 8:00 / 12:00 / 18:00. Planning mixes Favorites with new Dishes, asks for confirmation, and asks "What do you want to change?" on a no. Meal Plan edits the Member asks for in chat apply straight away with undo. Each meal needs a calorie share so the day forecast can be calculated.

**Change from #21 (2026-09-30):** The week now runs Sunday to Saturday instead of Monday to Sunday. The Sunday Prep Session now belongs to the week it feeds, not the week before. The catch: after Friday planning, only Saturday (and Sunday morning) is left to shop.

## Answer

### Week and slots
- The week runs **Sunday to Saturday** (changed from Monday to Sunday in #21). It's planned Friday at 3pm (#05), which leaves Saturday to shop before it starts. The Sunday Prep Session is the first day of the week it cooks for.
- Every day has **breakfast, lunch, dinner and a snack**. Meals are at 8:00 / 12:00 / 18:00. Slots can be added or removed on any day.
- Every snack is **timestamped**. The recap says when it was eaten (between which meals, or after dinner). Snacks outside the plan, or extra ones, are logged, count toward the day forecast, and can lead to a Rebalance being proposed.

### Calories
- The Calorie Target is split breakfast 25%, lunch 30%, dinner 35%, snack 10%. The split is editable.
- The plan is built to **95%** of the Calorie Target (editable), so small logging errors don't break the deficit.
- Eating-out days may plan up to 100%, but must stay under the Calorie Target. Staying in the deficit comes first.
- **Phase 2:** balance the deficit across the week (the week stays in deficit even if a date night goes over).

### Special days and slots
- **Eating Out:** a labelled slot, one-off or recurring ("Date night", "Tuesday work lunch"). It counts the slot's normal share unless the Member allocates more, and the Agent may ask for a ballpark. After 3 logged occasions of a label, the Agent plans with their average and says so.
- **Busy Day:** a tag, one-off or recurring ("every Wednesday"). That day the Agent favours leftovers, eating out, or pre-cooked food, and every meal takes 15 minutes or less.
- **Open:** calories set aside, nothing planned.

### Choosing Dishes
- Priority:
  1. Leftovers first
  2. **Favorites and new Dishes as equals, with some randomness** (the Member enjoys trying new food)
  3. Raw ingredients already in the Pantry break ties between otherwise equal choices
- Pre-cooked or packaged meals only on Busy Days or when asked.
- **2 new Dishes a week** (editable).
- **Cook once, eat several times** is allowed. The same Dish appears at most **3 times a week** (editable). Planned leftovers show on the later meal as "from Sunday's dinner".

### Prep time
- Each Dish has one **total time** (prep plus cooking, no steps). The Agent estimates it when it first suggests the Dish.
- At the weekly reflection the Agent shows a table of the week's cooked Dishes with its time estimates ("Are any of these wrong?"), and saves any corrections.
- Default time limits per slot (editable): breakfast 10 min, lunch 15, weekday dinner 45, weekend dinner 90, snack 5. Busy Days: 15 min per meal. A meal over its limit gets a ⏱ badge in the draft.
- A batch counts its time once, on the day it's cooked. Leftover and prepped meals count about 5 minutes (reheat) or 0.
- **Weekend Prep Session:** the Agent may plan weekend cooking for weekday snacks and lunches (for example baking cookies on Sunday for the week's snacks). The time goes on the weekend, and those weekday meals count 0 minutes. Default: Sunday, up to 2 hours (editable).

### Portions and ingredients
- Portions are sized in grams to each meal's calorie share, rounded to kitchen-friendly amounts within ±5%. The amount cooked is the sum of the Portions plus planned leftovers.
- Missing Ingredients show as a badge on each meal ("Needs: salmon · on Grocery List" / "bought ✓"), plus a total count on the plan screen.

### Editing
- Swap (the Agent offers 3 alternatives), edit ingredients or amounts, move to another day or slot, or clear (it becomes Open). Any of these works through chat or on the week's Meal Plan page. Day totals update live against the Calorie Target and turn red if over.
- **After approval:**
  - Changes are allowed, and the Agent shows what changed in the week's meals.
  - Replacements come from the Pantry first; a trip to the store is the last resort.
  - The Grocery List updates: new Missing Ingredients are added, and Agent-added items no longer needed are removed if still unticked. Items the Member added are never removed.

### Phase 3
- Dinners shared by default; breakfasts, lunches and snacks individual. Any meal can be switched.
