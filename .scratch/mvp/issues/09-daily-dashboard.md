# What does the daily dashboard show?

Type: prototype
Status: open
Blocked by: 01, 05, 08

## Question

Make a rough, clickable mock-up of a Member's main screen and react to it. It should show today's calories against the Calorie Target, what's left, the planned meals, the Calorie Log, a Rebalance suggestion when over, and a way into chat, the Pantry and the Grocery List. What belongs on the first screen, and what one tap away?

## Comments

**Input from #05 (2026-09-27):** The dashboard also has to show Check-in cards (leftovers, skipped meal, unbought ingredient), a Rebalance proposal, the Activity Log with undo, a way into Schedules, and Favorites. Recaps (daily 9:30pm, weekly, monthly, custom) are dashboards too.

**Input from #08 (2026-09-29):** The Rebalance card shows the top 2 options plus "See all options". Each option shows calories saved and where the day lands. There's one live proposal at a time, and it expires when its meal's slot time passes. A skipped meal shows as "skipped", not blank. When Eating Out is still to come, the card shows a calorie aim for it.

**Prototype (2026-09-29):** `prototypes/09-daily-dashboard-PROTOTYPE.html` (throwaway). Double-click to open. It has three layouts, switchable with `?variant=A|B|C` or the ← → keys, plus an Over / On track toggle. A: calorie ring, timeline of meals and bottom tabs. B: a "Needs you" feed of cards with a chat box for logging. C: a table of planned vs. eaten per meal, a menu drawer and a + button. The scenario: target 2,000, 3 extra cookies at lunch, forecast 2,195, which triggers a Rebalance. Waiting for the Member's reaction.

**Feedback round 1 (2026-09-29):** No single layout wins. They're combined into variant D (now the default):
- **Calorie counter:** B's header (big "left" number, one-line eaten/target, forecast bar).
- **Navigation:** A's bottom tabs (Today, Plan, Pantry, Grocery, Chat). In the real build each tab opens **its own page**, not a pop-up.
- **Day view:** C's table of planned vs. eaten per meal, **with the Calorie Log merged in**: each food is listed under its meal with its calories.
- **Rebalance:** only a **Rebalance button** on the dashboard, with no options shown. Tapping it opens chat, where the Agent asks for the Member's input first ("how are you feeling about the rest of today?"), then offers the options that fit. This replaces the #08 input above about showing the top 2 options on the dashboard card.
- **Entry:** C's **+ quick entry** button stays, next to a **chat box for the Agent**.
