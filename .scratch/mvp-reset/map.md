# Map: Calorie Manager MVP (reset)

Label: wayfinder:map

## Destination

A buildable spec for a one-person MVP: a Recipe database, a weekly Meal Plan the Agent drafts in a planning chat from Recipes and Meal Times (seeded with a few use-up items), a shopping list from the plan where I tick off what I already have, quick calorie logging, and a Rebalance command. It runs on minimal AI, and its data model leaves room for the adaptive end goal.

## Notes

- **MVP success test:** after a two-week beta, I logged every day with almost no friction, stayed under the Calorie Target on most days, planned the week on Friday in under 15 minutes, and shopped from the app's list. Anything that serves none of these is out.
- **Real week:** plan next week on Fri/Sat, shop and do some meal prep on Sat/Sun. Dinners are the most planned. Outsourced meals (Tuesday work lunch) are what made tracking hard before.
- **AI is kept to a minimum** (a hobby budget, and cheaper per user if it's ever sold). AI goes into planning and Rebalance conversations. Logging and Recipes work without it.
- This map replaces [Calorie Manager MVP](../mvp/map.md). What carries over is settled in [Which of the old map's decisions carry over?](issues/02-carry-over-old-decisions.md); the rest of the old map is background reading only.
- Vocabulary is in `CONTEXT.md` at the project root (Recipe, Meal Time, Cook, Calorie Target, planning band, Shopping list, Week view).
- Skills: grilling + domain-modeling by default; prototype for UI questions; research for outside facts.
- Tracker: local markdown. Tickets are `issues/NN-<slug>.md`; research findings go in `research/`.

## End goal (later phases, not this map)

A calorie tracker that adapts: when a meal goes over, it recommends lighter options from what's at home, including cooking a different Recipe. This map builds the base for it (Recipes, Meal Times, Cooks). After a few days or weeks of using the MVP, come back and pick which of these go into the next phase:

- An in-app Pantry and suggestions adapted to what's at home, with optional expiry dates the Agent plans around.
- Body stats, weigh-ins (weekly reminder by default), workouts that add burned calories, and a calculated Calorie Target with a chosen deficit.
- Balancing the deficit across the week, so one day can go over if the rest make up for it.
- Preferences (allergies, diets, dislikes with hard/soft rules) and Favorites.
- A second Member: her own login, Spanish, shared meals with a Portion each, clashing Preferences, rebalancing a shared meal.
- Safety rails: a low-target warning, never proposing a skipped meal, support resources.
- Recipes with cooking steps, AI-created Recipes, Kitchen Tools, ratings.
- Barcode scanning, a bulk branded import, macros, budget tracking.
- A general Chat page, Agent notes, Check-ins, push notifications, an offline shopping list, full Recaps and Stats.
- Making it a product for other people: market research, Vercel Pro, many accounts and Households.

## Decisions so far

<!-- one line per resolved ticket: [title](issues/NN-slug.md): gist -->

- [Which database could supply packaged and branded foods?](issues/01-packaged-food-databases.md): USDA FoodData Central Branded Foods through the existing API (CC0, free, has GTINs). Open Food Facts isn't needed. Generic matches are fine per gram, not per piece. The Food Library gets a source, GTIN, brand, per-100 g calories and serving sizes now.
- [Which of the old map's decisions carry over?](issues/02-carry-over-old-decisions.md): Keep the PWA, the Sunday–Saturday week and a trimmed stack (Next.js + Supabase + Vercel; no cron runner, push or offline). Sign-in is username + password via Supabase Auth, accounts made by hand, no public sign-up. One person only, English only, no Preferences or safety rails. Logging uses a local parser with AI only for unmatched parts, and Undo toasts instead of an Activity Log. Agent files keep their structure without notes or jobs. Everything else is dropped; the old phases moved to the End goal.
- [What does setting up Meal Times look like?](issues/03-meal-times-settings.md): A week grid (rows are Meal Times, columns are weekdays; tap a cell to toggle a day, a name to edit) with day totals against the aim and target under each column, and Target and band in its toolbar. Kinds are now **Set** (one number), **Planned** and **If room**. An overlap on the same day asks whether the new one replaces the other there.
- [What does entering a Recipe look like?](issues/04-recipe-entry.md): A plain searchable Recipe list (starred first, cal/serving) opens an editor with a Recipe Facts panel, an ingredient table with each one's calorie share, a Food Library search sheet with a type-it-from-the-label form, and a weighed / N-servings yield with a weigh-the-pot helper. Meal Time tags are a hint the Agent prefers, not a rule. Copying makes a linked variation.
- [What does planning the week look like?](issues/05-plan-page.md): The week grid fills the Plan page (Meal Times × days, each Cook coloured, 🔥 on cook day, day totals and bars against the aim, a Cooks list with servings placed/made) and the planning chat is a drawer at the bottom. Tap a meal to resize, move, swap or remove it; the picker offers spare Cook servings first, then tagged Recipes (starred first), then the rest. Approve builds the shopping list; after it, changed meals are outlined and the list updates only after you review the change. The list follows Cooks' servings made, not Portion sizes.
- [What does the shopping list look like?](issues/06-shopping-list.md): One list by store section (from the food's USDA category, movable and remembered) with an 🏠 At home tab to tick what's there and a 🛒 Shop tab to tick into the cart. One line per food in one shopping measure from its Food Library serving sizes, rounded up; "have some" buys only the rest; items can be added by hand. After a Cook change, Review shows each line's change: had-it lines go back to unticked when more is needed, bought lines stay bought (a new line for the rest, or spare, or "Bought, not needed now"). Rebalance never changes the list unless it changes a Cook's servings made.

Settled while charting (2026-10-01), before any ticket:
- **Recipe** replaces Dish: a name and ingredients with amounts, with calories shared out by cooked weight ("makes N servings" as the fallback). No steps, prep time, tools or ratings in the MVP. Entered by hand, with ingredients from USDA FoodData Central and branded items typed in once from the label.
- **Meal Times** replace breakfast/lunch/dinner/snack: a name, a time, weekdays and a calorie range, of three kinds (Set, Planned, If room). Set calories are held first; the Agent fills Planned times, then If room times while calories are left.
- **Calorie Target** stays one ceiling (what "days under" counts). Planning aims for a **planning band** under it (90–100% by default, editable). Ranges are guides.
- **Cook:** one batch of a Recipe feeds several Meal Times and is counted once on the shopping list.
- **Planning** is a chat on the Plan page, fresh each week. The Agent drafts, you edit on a grid, and Approve builds the shopping list. It can't invent Recipes.
- **Rebalance** is a command. It changes the rest of today by default, or the rest of the week if asked, using only Cooks already planned. It never touches Set times or takes a Planned time below its range. Nothing changes until approved.
- **Logging:** one tap for a planned or Set meal; otherwise search Recipes and the Food Library; a single AI estimate only when nothing matches.
- **Shopping list:** the "have it" pass is the Pantry check; then shop. No Pantry in the app.
- **No general chat:** Plan and Rebalance are the only conversations.

## Not yet specified

- The Agent's tools and instructions for planning and Rebalance: what it reads, what it may write, and how it's tested. This comes after the Plan page and the Rebalance conversation are mocked up.
- The model bake-off (old [Which AI model passes the bake-off?](../mvp/issues/18-model-bake-off.md)): it waits for an Agent to test, and its test set needs redoing for planning and Rebalance.
- Once the tickets and these are settled, the spec is split into build tickets.

## Out of scope

- Everything listed under End goal.
- Prep Sessions and Busy Days as separate concepts, Google sign-in, public sign-up, a translation file.
- The old map's open tickets (Plan, Pantry, Grocery, Chat, Settings, Agent estimates, Cooking, Dishes, model bake-off) are superseded by this map.
