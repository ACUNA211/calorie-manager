# How does Rebalance work?

Type: grilling
Status: resolved
Blocked by: 05, 06

## Question

When a Member goes over (or is about to go over) their Calorie Target, for example extra cookies at lunch, what can a Rebalance change? Only the rest of today, or tomorrow too? Only that Member's Portions, or swapping whole meals? What happens when dinner is a shared meal? Does it propose options or apply one? Does it use only Pantry food? What if no plan can get them back under today?

## Comments

**Input from #05 (2026-09-27):** **Trigger:** the day forecast (logged so far + remaining planned > Calorie Target). A single meal going over doesn't count on its own. **Propose only:** the Agent names the cause ("Lunch was 300 over"), proposes a smaller Portion with its size, and offers other options. The Member can push back or ask "Is that enough?" Nothing changes until they choose. The meal-slot check-in (2h after a slot with nothing logged) asks what was eaten, which feeds the forecast.

**Input from #06 (2026-09-27):** Each meal's share is 25/30/35/10 (breakfast/lunch/dinner/snack), and the plan is built to 95% of the Calorie Target, so a Rebalance only fires once that 5% margin is used up. Unplanned or extra snacks count toward the forecast. An Eating Out slot counts its normal share (or the Member's ballpark, or its learned average) until it's logged. Balancing across the week is phase 2.

## Answer

### Trigger and timing
- **Trigger:** the day forecast (logged so far + remaining planned) goes over the Calorie Target (#05). Propose only. Nothing changes until the Member picks an option.
- **Where:** straight away in the chat reply to the log that caused it, plus a dashboard card (changed by #09: a red Rebalance button on Today and an item on the Chat tab badge).
- **One live proposal at a time.** A new log recalculates it. It disappears if the forecast drops back under the target, and expires when its meal's slot time passes.

### Scope
- **Only today's remaining meals.** Tomorrow is never touched in the MVP. Balancing across the week is phase 2.

### Options
The Agent offers every option that applies, each with the calories saved and where the day lands ("-320 · day ends 40 under"). The point is to give the Member a real choice, so picking one feels like an achievement even though they're giving something up. Ordered by how little they change the plan:
1. **Ingredient swap** in the same Dish (half the rice, less oil)
2. **Smaller Portion of the next meal**, with its size
3. **Smaller Portion spread across the rest of the day.** The Agent explains how this differs from option 2, and the Member decides.
4. **Lighter Dish swap** (a second one if the Pantry has a good one)
5. **Drop the snack** (always last, and never the only option)

- Chat shows all of them. The dashboard card shows the top 2 plus "See all options" (changed by #09: the dashboard shows only a Rebalance button, and the Agent asks for the Member's input first, then offers the options that fit).
- Options that don't apply are left out (for example, no snack drop when no snack is left).

### Pantry and store runs
- **Pantry only.** A store run is offered only after the first proposal is turned down *and* at least 2 more Pantry-based alternatives for different meals are turned down. It then offers a lighter Dish needing 1–2 items, which go onto the Grocery List if the Member picks it.
- If the Member asks for something the Pantry doesn't have ("could I have salmon instead?"), the store-run option comes up straight away, since it's the Member's request (#05).

### Floor and skipping meals
- **Floor:** no meal is proposed below **50% of its share** (editable). Skipping breakfast, lunch or dinner is never proposed.
- **If no option gets the Member back under:** the Agent recommends a light meal and accepts a small overage ("You'll land about 250 over today. That's fine, and tomorrow is back to normal").
- **The snack is exempt** from the skip rule (10% of the day, optional). When the snack is the last slot left, the options are a smaller snack, a lighter snack swap, or dropping it.
- **When a Member says they're skipping a meal:** the Agent strongly discourages it, says why (energy crashes, overeating later, muscle loss, building a bad habit), shows support resources (eating-disorder help lines), and asks them to confirm. If they confirm, the meal is marked **skipped** (not deleted), and the recap notes it neutrally. The reasons and resources live in the Agent's Rebalance markdown file. The resource numbers are checked at build time, and phase 3 adds Spanish-language ones.

### Other cases
- **Over after the last meal** (for example a 10pm snack): no Rebalance. The 9:30pm recap, or the next day's view, notes "X over today" neutrally. The weekly reflection can point out patterns.
- **Eating Out still to come:** the Agent gives a calorie aim and advice for ordering ("Aim for about 550 at dinner: grilled protein and a salad"). Accepting it lowers that slot's allowance in the forecast. Other options can sit alongside it.
- **Swapped-out Dish:** the Agent offers to move it to a later free slot that doesn't break other rules ("Move it to Thursday dinner?"), so bought ingredients aren't wasted. A no drops it.
- **Smaller Portion:** the food saved goes into the Pantry as leftover portions (#04), and the leftovers-first rule plans them in.
- **Shared dinner (phase 3):** only that Member's Portion changes. The Dish and the other Member's plate stay the same.

### Related: Calorie Target floor
- The Calorie Target settings **warn but allow** a target below a safe floor (1,500/day for men, 1,200 for women). Phase 2's calculated target keeps the same floor. (Added to #03.)
