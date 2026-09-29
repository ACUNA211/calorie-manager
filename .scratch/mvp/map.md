# Map: Calorie Manager MVP

Label: wayfinder:map

## Destination

An **MVP spec** for a two-person Household app, with every product and tech decision made and ready to split into build tickets. It covers Pantry, a weekly Meal Plan with a Portion for each Member, a Grocery List for the coming week, a Calorie Log (Food Library search plus Agent-estimated calories), Preferences, and a built-in Agent you can chat with. The Agent drafts plans, Rebalances the day when a Member goes over, and reflects weekly.

## Notes

- Domain: consumer nutrition and meal planning for one Household (two Members today; this may grow later).
- Vocabulary lives in `CONTEXT.md` at the project root. Use its terms.
- Skills: grilling + domain-modeling by default; prototype for anything about UI; research for outside facts.
- Standing preferences:
  - Dashboard-first: everything important is visible and editable without talking to the Agent.
  - The Agent is chat plus reflection and recommendations. It supports the app; it doesn't replace it.
  - The Agent's behaviour is defined in markdown files. App data (Pantry, logs, plans) lives in a database.
- Tracker: local markdown. Tickets are `issues/NN-<slug>.md`; research findings go in `research/`.

## Decisions so far

<!-- one line per resolved ticket: [title](issues/NN-slug.md): gist -->
- [Where do calorie counts come from?](issues/02-calorie-data-sources.md): The Agent's LLM splits free text into items and grams, then looks each one up in USDA FoodData Central (free, public domain, results cached in the Food Library). When there's no match it falls back to an LLM estimate marked as estimated. Nutritionix and Edamam are ruled out on cost.
- [Phone app or website?](issues/01-phone-app-or-website.md): An installable web app (PWA), phone-first for Android, and fully usable in a laptop browser. No native app.
- [Language: English and Spanish](issues/10-language.md): All data is stored in English, and screen text lives in one translation file. Phase 3 adds a Spanish view and a Spanish-speaking Agent for the second Member, and keeps her original Spanish wording alongside the English name.
- [Calorie Targets and Preferences](issues/03-calorie-target-and-preference-rules.md): The MVP target is typed in by hand and the same every day. Phase 2 calculates it from body stats, weigh-ins and workouts. Allergies are always hard. Diets and dislikes each have a hard/soft switch, and a soft dislike may be blended in unnoticed. Breaking your own hard rule warns but allows. On a shared meal, either Member's hard rule applies to everyone.
- [What does the Agent do on its own vs. when asked?](issues/05-agent-autonomy.md): What a Member asks for happens straight away with undo. What the Agent suggests waits for a yes, and nothing is approved automatically. Every schedule can be edited in the app or through chat. Defaults: Friday 3pm reflection, then planning (the Grocery List updates when the plan is approved), a 9:30pm daily recap, and meal-slot check-ins at 8, 12 and 6 (+2h). Rebalance is proposed only, when the day forecast goes over the Calorie Target. The Grocery List is always live, with an unbought-ingredient alert at 3pm the day before. Dish feedback gives Restriction / Dislike / Just this dish, plus a Favorites list. Activity log with undo. One chat per Member.
- [How is a Meal Plan built?](issues/06-meal-plan-shape.md): The week runs Monday to Sunday, with breakfast, lunch, dinner and a timestamped snack every day. Calories are split 25/30/35/10 and planned to 95% of the Calorie Target. Eating-out slots are labelled and learn their calories after 3 occasions. Busy Days have 15-minute meals. Leftovers come first, then Favorites and new Dishes as equals (2 new a week), with Pantry ingredients as the tiebreaker. Each Dish has a prep time, with limits per slot and a weekend Prep Session. Meals can be swapped, edited, moved or cleared through chat or on the page, and changes after approval show what changed, with the Pantry first.
- [How precise is the Pantry?](issues/04-pantry-precision.md): Exact amounts for the main foods, have / low / out for staples. Amounts show as grams plus cups or pieces, and pounds typed in are converted. A meal marked cooked (via the Agent's day recap or by hand) subtracts its ingredients, and leftovers go back in as portions. Food logged outside the plan is subtracted only if the Member confirms it came from the Pantry. Agent quick-add asks for confirmation. Expiry dates come in phase 2.
- [How is the Grocery List built?](issues/07-grocery-list.md): The Agent suggests low or out staples and usual buys running out. Each food has one measure (pieces, cups plus grams, cups plus mL, or grams) showing the shortfall. Lines are ordered by store section, and one ingredient needed by several meals is one line. Ticking crosses an item off at the required amount, which can be edited up or down and goes into the Pantry, and a shortfall gets an automatic remainder line. Crossed-off items clear at midnight. Ticking works offline, with one shared list. Chat from the list handles substitutes. Agent list changes are logged with undo. A Kitchen Tools checklist keeps Dishes needing missing tools out of the plan.
- [How does Rebalance work?](issues/08-rebalance.md): Only today's remaining meals, Pantry only, shown straight away in chat plus a dashboard card, with one live proposal at a time. Every option that applies is offered with calories saved: ingredient swap, smaller next Portion, smaller Portion spread across the day, lighter Dish, and dropping the snack. A store run is offered only after the Pantry options and 2 more Pantry alternatives are turned down, or when the Member asks for a missing item. No meal is proposed below 50% of its share and skipping a meal is never proposed; the fallback is a light meal and a small overage. If a Member skips a meal, the Agent discourages it, shows support resources and asks them to confirm. A swapped-out Dish can move later in the week, and food saved from a smaller Portion becomes leftovers. The Calorie Target warns below 1,500/1,200.
- [What does the daily dashboard show?](issues/09-daily-dashboard.md): Today shows the weekday and date, a big "calories left" counter with a forecast bar, and one table of planned vs. eaten per meal with each logged food and its calories listed under its meal. When the day forecast goes over, a red Rebalance button appears, with no options on the dashboard: the Agent asks for input first, then offers options. A + quick-entry button sits next to an Agent chat box. Bottom tabs (Today, Plan, Pantry, Grocery, Chat) each open a full page. A red badge on Chat counts open Check-ins plus a live Rebalance, each answerable by quick options or chat, so Check-ins are no longer dashboard cards. The Activity Log and Schedules move into Settings under ☰, to be designed later. Prototype: `prototypes/09-daily-dashboard-PROTOTYPE.html`.
- [Which tech stacks fit the MVP?](issues/11-stack-options.md): Research recommends Supabase (Postgres, Auth, Realtime, and a per-minute cron that reads a Schedules table) with a Next.js PWA on Vercel Hobby, at $0/month hosting, and Claude Sonnet 5.5 via the AI SDK at about $14 per Member per month. The runner-up is Cloudflare Workers + D1. Offline Grocery ticking needs a hand-built queue on any stack. The choice itself is made in [Which stack and hosting do we build on?](issues/12-stack-and-hosting.md).

## Phases

**MVP: one Member.** Only the primary user is active, and he beta tests it for a couple of weeks. The database is still built for a two-Member Household from day one (a Portion per Member, a Calorie Log per Member), so adding the second Member later means creating her login, not rebuilding anything.

**Phase 2: ready to be a full product.** Everything the second Member needs so she doesn't have to do anything by hand:
- Body stats (age, sex, height, weight) and a calculated Calorie Target
- Weigh-ins: a weekly reminder by default, daily entries allowed, and the frequency is an editable setting
- Workouts that add burned calories, with the Meal Plan built for the chosen deficit
- The full Preferences page, with specific diet options
- Optional Pantry expiry dates, with the Agent planning around food that expires soon
- Balancing the deficit across the week instead of each day, so a date night can go over if the rest of the week makes up for it (#06)

**Phase 3: the second Member joins.**
- Her login and the Spanish view (see [issues/10-language.md](issues/10-language.md))
- Shared meals with a separate Portion for each Member
- Clashing Preferences on a shared meal (either Member's hard rule applies to everyone, and soft dislikes become per-person add-ons)
- Rebalancing a shared meal

**Later (phase 3 or 4):** budget tracking. **Future:** recipes with cooking steps.

## Not yet specified

- **The other pages**: Plan, Pantry, Grocery and Chat each open as a full page (#09), and Settings (Activity Log, Schedules, Calorie Target, Preferences, Kitchen Tools) is still to be designed. Which of these need a prototype before building, and which are settled enough by #04–#08?
- **Adding food by chat vs. the + button**: how a free-text log ("2 eggs and toast") is confirmed before it lands in the Calorie Log, and how a Member corrects an estimate. Partly set by #02 and #09. It may need a small prototype once the stack is chosen.

## Out of scope

- Macros (protein, carbs, fat)
- Recipes
- Barcode scanning
- More than one Household, or users outside the Household
