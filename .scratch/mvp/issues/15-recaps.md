# What does a Recap show?

Type: prototype
Status: resolved
Assignee: ACUNA211
Blocked by:

## Question

Make a rough mock-up of the Recap page (opened from Today's header) and react to it. #05 set when recaps happen: daily at 9:30pm, weekly on Friday at 3pm leading into planning, plus monthly and custom ranges. The weekly one covers keeping to the plan (from the Activity Log), quick recommendations, and Grocery List items the Member added. What does each period show (calories against the Calorie Target per day, meals kept vs. swapped or skipped, Rebalances, eating out), how do the Agent's recommendations appear and get accepted, and how does the weekly Recap hand off to planning?

## Comments

**Prototype (2026-09-30):** `prototypes/15-recaps-PROTOTYPE.html` (throwaway, also linked from the GitHub Pages index). It has three layouts of the Recap page, switchable with `?variant=A|B|C` or the ← → keys. Each has Day / Week / Month / Custom tabs. A: report card (stat tiles, calories-per-day chart, sections for meals vs. plan, Rebalances, Eating Out and Grocery List adds, recommendation cards, and a sticky "Plan next week" button). B: an Agent walkthrough, one topic per step with a question on each, where the last step is "Ready to plan next week?". C: a ledger with a row per day and a mark per meal (kept / swapped / Eating Out / dropped / unlogged), a month calendar, and recommendations as a "For next week's plan" checklist. Accepted recommendations carry into a Plan stub. The scenario: a 2,000 target, daily Recap on Wed Sep 30 at 9:30pm, weekly on Fri Oct 2 at 3pm covering Fri Sep 25 – Thu Oct 1. Waiting for the Member's reaction.

**Feedback round 1 (2026-09-30):** A wins overall, especially the recommendation cards and the stat tiles at the top. They're combined into variant D (now the default):
- **Recap stays a quick view:** A's tiles, bar graph and recommendation cards, with "Plan next week →" on the weekly one. It's a quick look before planning.
- **New Stats page** with C's breakdown: a row per day with a mark per meal (tap to expand), the month calendar, and a table per week. Meals vs. the Meal Plan, Rebalances, Eating Out and Grocery List adds move here from the Recap. Stats opens from the Recap ("Full breakdown in Stats ›") and from ☰.
- **Weekly period:** the last 7 days, not including today. So Friday's reflection covers Friday to Thursday.
- **A missing meal:** the day isn't counted in the average, days under or deficit. The Agent pings to ask whether the meal was skipped (the slot Check-in, then the 9:30pm Recap). With no answer that day, the day stays grey as missing.
- **Month and custom Recaps** get recommendation cards too, and accepted ones go into the coming week's Meal Plan.

**Feedback round 2 (2026-09-30):** A second card under the tiles shows **Followed the plan** (meals kept as planned, planned Eating Out included, e.g. 22 / 28 with a progress bar, how many were swapped and how many are missing) and **Ate out** (how many times, planned vs. unplanned, and how many went over their aim). It appears in the Week, Month and Custom Recaps.

**Feedback round 3 (2026-09-30):** A planned Eating Out meal counts as following the plan only if it lands within its calorie aim. In the scenario that's 21 / 28: pizza night (1,050 against 800) doesn't count.

## Answer

Settled with the prototype (`prototypes/15-recaps-PROTOTYPE.html`, variant D, hosted on GitHub Pages). A's report card won, and C's breakdown moves to a separate Stats page.

### Recap (opened from Today's header, the 9:30pm "Your day" push, or the Friday "Weekly reflection is ready" push)
- **Periods:** Day / Week / Month / Custom tabs. **Week is the last 7 days, not including today**, so the Friday 3pm reflection covers Friday to Thursday. Custom has from/to dates. Monthly stays off by default (#05).
- **Top tiles:** daily average (vs. the Calorie Target), days under, and deficit (with approximate pounds).
- **Plan card under the tiles:** **Followed the plan** (meals kept as planned out of all meal slots, with a progress bar, then swapped / ate out over / missing) and **Ate out** (how many times, planned vs. unplanned, and how many went over their aim). A planned Eating Out meal counts as followed only if it lands within its calorie aim.
- **Bar graph:** calories per day with a dashed Calorie Target line. Days under are green, over are red, missing are grey. "Full breakdown in Stats ›" sits under it.
- **Recommendation cards:** each has a kind (Pattern, Swaps, Grocery List, Eating Out, Dishes), a short reason with the numbers, one-tap answers (e.g. "Add to next plan" / "No thanks", or Dislike / Restriction / Just this dish), and "Chat ›". An answered card shows what was chosen, with Undo. **Accepted recommendations from any period (week, month or custom) go into the coming week's Meal Plan.**
- **Hand-off to planning (weekly):** a sticky **Plan next week →** button showing how many changes were accepted. It opens the Plan page, where the Agent drafts next week with those changes listed, plus the usual rules (#06). If planning hasn't started by 7pm, the #05 reminder still applies.
- **Daily Recap:** tiles (eaten, result vs. target, meals logged), a meals list with planned vs. eaten, any Rebalance that day, then tonight's questions: was each meal cooked (yes subtracts from the Pantry), any leftovers (added as a portion and planned later), and a rating for any new Dish (👍 asks "Add to Favorites?", 👎 asks Restriction / Dislike / Just this dish). It ends with one quick Agent note and "Chat ›".

### Missing meals
- A meal slot with nothing logged is **missing**. The Agent asks whether it was skipped (the slot Check-in at +2h, then again in the 9:30pm Recap). If there's no answer that day, it stays **grey** as missing.
- A day with a missing meal **isn't counted** in the average, days under or deficit ("4 / 6, 1 not counted"), and a note under the graph names it.

### Stats (new page, from the Recap or ☰)
- Week / Month / Custom tabs.
- **Week:** a row per day with a mark per meal (kept, swapped, Eating Out, dropped, missing), day total and Rebalance tag. Tap a day for its meals. Below it: meals vs. the Meal Plan counts, Rebalances (accepted / declined), Eating Out vs. aims, and items the Member added to the Grocery List.
- **Month / Custom:** a calendar with each day's difference from the target (grey for missing), a table per week (average, days under, deficit), and patterns (Fridays, Rebalances, meals kept, most swapped Dish, new Dishes rated 👍).
