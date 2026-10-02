# What does the shopping list look like?

Type: prototype
Status: resolved
Assignee:
Blocked by: [What does planning the week look like?](05-plan-page.md)

## Question

Mock up the shopping list built when the plan is approved: each Cook's ingredients combined into one line per food, scaled to the Cook. First a "have it" pass where you tick what's already at home (this replaces an in-app Pantry), then shopping, ticking items into the cart. How are amounts shown (one measure per food)? Can items be added by hand? What happens to the list when the plan changes after approval, or when a Rebalance needs something new? Is it ordered by store section, and if so, where does each food's section come from? From #05: the list is scaled to each Cook's servings made (not Portion sizes), and after approval a plan change shows a Review of the lines it adds, changes or removes before "Update shopping list". What happens to lines already ticked as "have it" or bought?

## Comments

**Resolution (2026-10-01):** layout **D, B's one list with A's At home / Shop tabs**, from [the prototype](../prototypes/06-shopping-list-PROTOTYPE.html?variant=D) (A, B and C are kept in the file for reference).
- **The page:** two tabs. **🏠 At home** is the whole list by store section; tick 🏠 on what's already there (the Pantry check). **🛒 Shop** shows what's left to buy by section, ticked into the cart (ticked lines drop to the bottom of their section), with what's at home folded away and a "Need it" button to bring a line back. A count under the title: to buy, at home, in cart.
- **Lines:** one per food, combined across Cooks and scaled to each Cook's servings made. Tap a line for each Cook's share, "have some" (type what's at home; only the rest is to buy), the shopping measure and the section.
- **Amounts:** one measure per food, chosen from its Food Library serving sizes (broccoli in heads, turkey in lb). Recipe amounts are converted through grams and rounded up: whole pieces, cans, packets and tbsp, ¼ lb or cup, 10 g. Changing a food's measure is remembered for that food.
- **Store sections:** Produce, Meat & fish, Dairy & eggs, Bakery, Frozen, Pantry, Other, in that order. A food's section comes from its USDA FoodData Central category (Branded Foods have their own, so canned tomatoes land in Pantry). Moving a food is remembered for it.
- **Added by hand:** an "Add an item" box. A Food Library match gets its section and measure; anything else is a plain line under Other. Plan updates never touch these.
- **After the plan changes:** only Cook changes (added, removed, servings made) change the list. A bar says how many lines would change; Review lists them as Added / Changed / Removed, each saying what happens to its ticks, then "Update shopping list":
  - to buy, more or less → the amount changes (with "was …");
  - had it, now more → back to unticked, with "you had …, it now needs …";
  - bought, now more → stays bought, and a new line for the rest;
  - bought, now less → stays bought, the rest is spare;
  - bought, now removed → moves to "Bought, not needed now" until dismissed;
  - had it or to buy, removed → gone.
- **Rebalance** only uses Cooks already planned, so moving or resizing Portions never changes the list. If it wants a Cook to make more servings, that is a Cook change and goes through the same Review.
