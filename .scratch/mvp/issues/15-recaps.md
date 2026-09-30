# What does a Recap show?

Type: prototype
Status: open
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
