# How precise is the Pantry?

Type: grilling
Status: resolved
Blocked by:

## Question

What does a Pantry item record: exact quantity and unit ("500 g chicken breast"), a rough level ("some", "low"), or just "have / don't have"? Does cooking or logging a planned meal automatically use up Pantry items, or do Members update the Pantry by hand? What about expiry dates? This decides whether Missing Ingredients and the Grocery List can be calculated or only estimated.

## Answer

- **Precision:** mixed. Exact amounts for the main foods (meat, produce, dairy, grains). Have / low / out for staples (oil, spices, condiments). Planned meals list each ingredient with amounts (no cooking steps, since recipes are out of scope), which lets Missing Ingredients be calculated.
- **Showing amounts:** grams plus a kitchen measure. Cups for scoopable foods ("550 g · about 2¼ cups"), pieces for countable ones ("12 eggs · about 600 g"). No lb/oz on screen. Everything is stored in metric.
- **Other units typed in:** if the Member types pounds or ounces, the Agent converts to grams and says so. For countable foods it asks for the count ("3 lb of chicken breast is about 1,360 g. How many pieces is that?").
- **Adding items:** (1) quick-add by typing, where the Agent turns free text into a labelled list and asks for confirmation before adding, (2) editing directly on the Pantry screen, including deleting expired food, (3) ticking items off the Grocery List while shopping, so they're in the Pantry at home (details in #07).
- **Cooking:** the Agent sizes each cooked meal to the Portions it has to feed. The **day recap** asks whether the planned meal was cooked, and a yes subtracts its ingredients. The Member can also mark a meal cooked at any time.
- **Leftovers:** the day recap asks "Any leftovers?" If yes, they go into the Pantry as portions, carrying the calories per portion. The Agent offers to plan them in ("Lunch tomorrow, or the day after? Who's having it?"). In the MVP it's always the primary Member. From phase 3 the Member is chosen.
- **Food logged outside the Meal Plan:** the Agent asks "Was this from the Pantry?" and subtracts only on a yes. It skips the question when the answer is obvious (for example "Popeyes fried chicken").
- **Expiry dates:** optional, phase 2 (not MVP). The Agent will then plan around food that's about to expire.
