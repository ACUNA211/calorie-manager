# Map: Calorie Manager MVP (reset)

Label: wayfinder:map

## Destination

A buildable spec for a one-person MVP: a Recipe database, a weekly Meal Plan the Agent drafts in a planning chat from Recipes and Meal Times (seeded with a few use-up items), a shopping list from the plan where I tick off what I already have, quick calorie logging, and a Rebalance command. It runs on minimal AI, and its data model leaves room for the adaptive end goal.

## Notes

- **MVP success test:** after a few weeks of real use (no fixed trial; it may simply stay a personal app), I logged every day with almost no friction, stayed under the Calorie Target on most days, planned the week on Friday in under 15 minutes, and shopped from the app's list. Anything that serves none of these is out.
- **Real week:** plan next week on Fri/Sat, shop and do some meal prep on Sat/Sun. Dinners are the most planned. Outsourced meals (Tuesday work lunch) are what made tracking hard before.
- **AI is kept to a minimum** (a hobby budget, and cheaper per user if it's ever sold). AI goes into planning and Rebalance conversations. Logging and Recipes work without it.
- This map replaces [Calorie Manager MVP](../mvp/map.md). What carries over is settled in [Which of the old map's decisions carry over?](issues/02-carry-over-old-decisions.md); the rest of the old map is background reading only.
- Vocabulary is in `CONTEXT.md` at the project root (Recipe, Meal Time, Cook, Calorie Target, planning band, Shopping list, Week view).
- Skills: grilling + domain-modeling by default; prototype for UI questions; research for outside facts.
- Tracker: local markdown. Tickets are `issues/NN-<slug>.md`; research findings go in `research/`.

## End goal (later phases, not this map)

A calorie tracker that adapts: when a meal goes over, it recommends lighter options from what's at home, including cooking a different Recipe. This map builds the base for it (Recipes, Meal Times, Cooks). After a few days or weeks of using the MVP, come back and pick which of these go into the next phase:

- An in-app Pantry and suggestions (and a "trash" action on Shopping list lines once ticking can mean "into the Pantry") adapted to what's at home, with optional expiry dates the Agent plans around.
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
- [What do Today and logging look like?](issues/07-today-and-logging.md): The date in the middle with ‹ › to page through days; calories left with a bar and where the day lands; a ⚖ Rebalance button beside it (today only, red when heading over). A confirm card for the meal that's due (✓ Ate as planned, ½ / ¾ / 1¼; Set: ✓ as set or Different amount), then the rest of the day with one-tap ✓. One box searches Recipes and the Food Library locally; unmatched parts offer one AI estimate, typed calories or Drop. Logs go to a Meal Time or another time, with Undo. Past days show unlogged meals as "not logged" to catch up; future days are read-only.
- [What does a Rebalance conversation look like?](issues/08-rebalance-conversation.md): ⚖ on Today (or "lunch went 400 over" in the box) opens a sheet of up to three option cards worked out on the phone without AI: shrink unlogged Planned Portions in ¼ servings within range, or drop If room times; Set and logged meals stay. A switch adds the rest of the week (each later day's smallest covering change; days under the aim left alone). The last card opens a chat with the Agent for anything else. Approve changes the plan with orange outlines and Undo; the shopping list never changes.

Settled in the artifact pivot (2026-10-10), see [ADR 0001](../../docs/adr/0001-artifact-and-claude-chat-instead-of-built-app.md):
- The MVP is **one Claude artifact with tabs** over Supabase. No Next.js, Vercel, PWA, AI API or model choice. Making it a product (web/phone app) is a later decision.
- The **Agent** is Claude in a chat, started by slash-command skills. The app's screens hold no chat.
- **No Pantry** in the MVP (reconfirmed).
- Skills carry a `-cal` suffix: `/plan-week-cal`, `/rebalance-cal`, `/add-recipe-cal`.
- **Rebalance** happens in chat only (`/rebalance-cal`); the Today tab just shows a day heading over. Supersedes #08's on-phone option cards.
- **Recipes** are added and changed through `/add-recipe-cal` (the Agent looks foods up in USDA and confirms calories per ingredient). The Recipes tab is a searchable, starrable list with a read-only view. Supersedes most of #04's editor.
- **No in-app chat.** The only AI inside the artifact is an **Estimate** button when logging finds no match (one question, one number back, on the Member's Claude account); typing calories is the fallback.
- **Shopping list** has one tick meaning "covered" (at home or bought); the two-tab At home / Shop design is dropped. Lines show their date added (`created_at`). Nothing is ever ticked automatically: unticked lines from any week stay until the Member ticks them, and the date shows what's overdue. When a Cook needs more after approval, a new unticked line is added for the extra; ticked lines are never unticked; no Review screen. Supersedes most of #06.
- **Plan tab edits:** resize (½–1½ servings) and remove in the app; swap and move go through the Agent.
- **Week view** is in the MVP (seven days against Target and band, days under, weekly average).
- **`chat-plan/`** becomes the starting point for `/plan-week-cal` (writing to Supabase instead of a CSV), then is removed with the superseded prototypes.
- **Barcode scanning** is in the MVP, pending a phone test: a "take photo" button, the barcode read in the page, and the number looked up in USDA FoodData Central (free) through Supabase's `http` extension. If the photo button fails inside the Claude app, a Nutrition Facts label photo read by Claude is the fallback. Supersedes #01's "don't build barcode scanning yet".
- **Logging search:** own Recipes and Food Library first; "Search USDA" on tap (through Supabase); Estimate last. Whatever is picked or estimated is saved to the Food Library.
- **Meal Times tab** is a full editor (name, time, weekdays, range, kind; add/delete) on #03's week grid, with Calorie Target and band in its toolbar.
- **Today** is the only day view; tapping a day in the Week view opens it there.
- **Approve** is a button on the Plan tab and builds the Shopping list (for now; revisit if an in-app chat is added).
- The **Shopping list** is the only grocery list and builds on the existing Supabase `grocery_list` table.

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

## Build tickets

**Status 2026-10-10:** everything not waiting on Sergio is built. The app is the Calorie Manager artifact (`app/calorie-manager.html`), the database changes are in `supabase/migrations/`, and the three skills are in `skills/`. Waiting on Sergio: #11 (phone test, then #17), a data.gov key for USDA, saving the skills, and a first real week (then #25).

Design is settled (2026-10-10). The work is split into tracer-bullet tickets, each a thin end-to-end slice:

- [#11 Barcode phone test](issues/11-barcode-phone-test.md) (spike, start anytime)
- [#12 Artifact shell + Meal Times](issues/12-artifact-shell-and-meal-times.md) → [#13 Food Library, Recipes, /add-recipe-cal](issues/13-food-library-recipes-and-add-recipe.md)
- Logging: [#14 Today search](issues/14-today-logging-by-search.md) → [#15 Search USDA](issues/15-search-usda-through-supabase.md), [#16 Estimate](issues/16-estimate-button.md), [#24 Week view](issues/24-week-view.md); [#17 Barcode scan](issues/17-barcode-scan.md) after #11 + #15
- Planning: [#18 /plan-week-cal + grid](issues/18-plan-week-cal-and-plan-grid.md) → [#19 edits + Approve](issues/19-plan-edits-and-approve.md) → [#20 Shopping list](issues/20-shopping-list-from-approve.md) → [#21 extra lines](issues/21-shopping-list-extra-lines.md)
- [#22 Confirm planned meals](issues/22-today-confirm-planned-meals.md) (after #14 + #18) → [#23 /rebalance-cal](issues/23-rebalance-cal.md)
- [#25 Cleanup](issues/25-cleanup-superseded.md) after #18

## Out of scope

- Everything listed under End goal.
- Prep Sessions and Busy Days as separate concepts, Google sign-in, public sign-up, a translation file.
- The old map's open tickets (Plan, Pantry, Grocery, Chat, Settings, Agent estimates, Cooking, Dishes, model bake-off) are superseded by this map.
