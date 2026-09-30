# What does a Recap show?

Type: prototype
Status: open
Assignee: ACUNA211
Blocked by:

## Question

Make a rough mock-up of the Recap page (opened from Today's header) and react to it. #05 set when recaps happen: daily at 9:30pm, weekly on Friday at 3pm leading into planning, plus monthly and custom ranges. The weekly one covers keeping to the plan (from the Activity Log), quick recommendations, and Grocery List items the Member added. What does each period show (calories against the Calorie Target per day, meals kept vs. swapped or skipped, Rebalances, eating out), how do the Agent's recommendations appear and get accepted, and how does the weekly Recap hand off to planning?

## Comments

**Prototype (2026-09-30):** `prototypes/15-recaps-PROTOTYPE.html` (throwaway, also linked from the GitHub Pages index). It has three layouts of the Recap page, switchable with `?variant=A|B|C` or the ← → keys. Each has Day / Week / Month / Custom tabs. A: report card (stat tiles, calories-per-day chart, sections for meals vs. plan, Rebalances, Eating Out and Grocery List adds, recommendation cards, and a sticky "Plan next week" button). B: an Agent walkthrough, one topic per step with a question on each, where the last step is "Ready to plan next week?". C: a ledger with a row per day and a mark per meal (kept / swapped / Eating Out / dropped / unlogged), a month calendar, and recommendations as a "For next week's plan" checklist. Accepted recommendations carry into a Plan stub. The scenario: a 2,000 target, daily Recap on Wed Sep 30 at 9:30pm, weekly on Fri Oct 2 at 3pm covering Fri Sep 25 – Thu Oct 1. Waiting for the Member's reaction.
