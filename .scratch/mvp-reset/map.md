# Map: Calorie Manager MVP (reset)

Label: wayfinder:map

## Destination

A buildable spec for a one-Member MVP: a Recipe database, a weekly Meal Plan the Agent drafts in a planning chat from Recipes and Meal Times (seeded with a few use-up items), a shopping list from the plan where I tick off what I already have, quick calorie logging, and a Rebalance command. It runs on minimal AI, and its data model leaves room for the adaptive end goal and a second Member.

## Notes

- **End goal (later phases, not this map):** a calorie tracker that adapts. When a meal goes over, it recommends lighter options from what's at home, including cooking a different Recipe. This map builds the base for it: Recipes, Meal Times, Cooks.
- **MVP success test:** after a two-week beta, I logged every day with almost no friction, stayed under the Calorie Target on most days, planned the week on Friday in under 15 minutes, and shopped from the app's list. Anything that serves none of these is out.
- **Real week:** plan next week on Fri/Sat, shop and do some meal prep on Sat/Sun. Dinners are the most planned. Outsourced meals (Tuesday work lunch) are what made tracking hard before.
- **AI is kept to a minimum** (a hobby budget, and cheaper per user if it's ever sold). AI goes into planning and Rebalance conversations. Logging and Recipes work without it.
- This map replaces [Calorie Manager MVP](../mvp/map.md). Its decisions are background reading until [Which of the old map's decisions carry over?](issues/02-carry-over-old-decisions.md) sorts them.
- Vocabulary is in `CONTEXT.md` at the project root (Recipe, Meal Time, Cook, Calorie Target and planning band).
- Skills: grilling + domain-modeling by default; prototype for UI questions; research for outside facts.
- Tracker: local markdown. Tickets are `issues/NN-<slug>.md`; research findings go in `research/`.

## Decisions so far

<!-- one line per resolved ticket: [title](issues/NN-slug.md): gist -->

- [Which database could supply packaged and branded foods?](issues/01-packaged-food-databases.md): USDA FoodData Central Branded Foods through the existing API (CC0, free, has GTINs). Open Food Facts isn't needed. Generic matches are fine per gram, not per piece. The Food Library gets a source, GTIN, brand, per-100 g calories and serving sizes now.

Settled while charting (2026-10-01), before any ticket:
- **Recipe** replaces Dish: a name and ingredients with amounts, with calories shared out by cooked weight ("makes N servings" as the fallback). No steps, prep time, tools or ratings in the MVP. Entered by hand, with ingredients from USDA FoodData Central and branded items typed in once from the label.
- **Meal Times** replace breakfast/lunch/dinner/snack: a name, a time, weekdays and a calorie range, of three kinds (Fixed, Open required, Open optional). The Agent fills Fixed first, then Open required, then Open optional with anything while calories are left.
- **Calorie Target** stays one ceiling (what "days under" counts). Planning aims for a **planning band** under it (90–100% by default, editable). Ranges are guides.
- **Cook:** one batch of a Recipe feeds several Meal Times and is counted once on the shopping list.
- **Planning** is a chat on the Plan page, fresh each week. The Agent drafts, you edit on a grid, and Approve builds the shopping list. It can't invent Recipes.
- **Rebalance** is a command. It changes the rest of today by default, or the rest of the week if asked, using only Cooks already planned. It never touches Fixed times or takes Open required below its range. Nothing changes until approved.
- **Logging:** one tap for a planned or Fixed meal; otherwise search Recipes and the Food Library; a single AI estimate only when nothing matches.
- **Shopping list:** the "have it" pass is the Pantry check; then shop. No Pantry in the app.
- **No general chat:** Plan and Rebalance are the only conversations.

## Not yet specified

- The Agent's tools and instructions for planning and Rebalance: what it reads, what it may write, and how it's tested. This comes after the Plan page and the Rebalance conversation are mocked up.
- The model bake-off (old [Which AI model passes the bake-off?](../mvp/issues/18-model-bake-off.md)): it waits for an Agent to test, and its test set needs redoing for planning and Rebalance.
- Once the tickets and these are settled, the spec is split into build tickets.

## Out of scope

- An in-app Pantry, and adapting from what's at home (the end goal, for a later phase).
- AI-created Recipes, cooking steps, Kitchen Tools, ratings.
- A general Chat page, Agent notes, Check-ins, push notifications.
- Full Recaps and Stats beyond the week view; Prep Sessions and Busy Days as separate concepts.
- The second Member, Spanish, body stats and calculated targets, workouts, macros, barcode scanning, budget tracking, more than one Household.
- The old map's open tickets (Plan, Pantry, Grocery, Chat, Settings, Agent estimates, Cooking, Dishes, model bake-off) are superseded by this map.
