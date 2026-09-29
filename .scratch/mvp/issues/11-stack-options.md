# Which tech stacks fit the MVP?

Type: research
Status: claimed
Assignee: ACUNA211 (research agent)
Blocked by:

## Question

Find 2–4 realistic stacks (framework, database, hosting, scheduler, AI model and provider) for this app, compare them, and recommend one. They must meet these constraints from earlier decisions:
- An installable PWA that is phone-first on Android and also works in a laptop browser (#01), with **web push notifications** on Android.
- Server-side **scheduled jobs in each Member's time zone** that run even when the app is closed: the Friday reflection and planning, the 9:30pm recap, meal-slot check-ins and the 3pm unbought-ingredient alert (#05).
- **Offline ticking** on the Grocery List that syncs later, and **live updates** across both Members' phones (#07).
- A relational database for Household data (Pantry, Meal Plan, Portions, Calorie Logs, Activity Log with undo).
- An Agent that chats with streaming and **tool calling** (read and write app data), with its behaviour defined in **markdown files**, calling USDA FoodData Central with an LLM fallback (#02).
- Two users. Cost and a solo developer's upkeep matter more than scale.

For each stack, cover setup effort, how each constraint is met, free-tier limits and the likely monthly cost at two users, and vendor lock-in. Also compare 2–3 AI models for this Agent (tool-use quality, cost per typical day of use, Spanish support for phase 3).

## Comments
