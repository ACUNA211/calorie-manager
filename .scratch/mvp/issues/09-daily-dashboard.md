# What does the daily dashboard show?

Type: prototype
Status: resolved
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

**Feedback round 2 (2026-09-29):** The header shows the weekday and date ("Wed · Sep 30") instead of the time. The Activity Log is taken off the dashboard and moves into Settings (☰ → Settings), alongside Schedules, Calorie Target, Preferences and Kitchen Tools. Settings will be designed later.

**Feedback round 3 (2026-09-29):** Check-ins are no longer cards on the dashboard. They become notifications: a 🔔 button next to the Agent chat box, with a red badge showing how many Check-ins still need answering. Tapping it lists them. Each one can be answered with basic quick options (for example "Plan it" / "Not needed") or taken into chat ("Chat ›"), where the Agent raises it with the same quick replies. Answering one either way clears it and lowers the count. This replaces #05's "shown in chat and as a dashboard card".

**Feedback round 4 (2026-09-29):** The 🔔 button is removed. The red badge sits on the **Chat tab** and counts open Check-ins **plus a live Rebalance**. The Chat page starts with a "Needs you (n)" list: the Rebalance (which opens the input-first flow) and each Check-in, with quick options or "Chat about it ›". The red Rebalance button stays at the top of Today.

## Answer

Settled with the prototype (`prototypes/09-daily-dashboard-PROTOTYPE.html`, variant D, hosted on GitHub Pages). No single layout won. The final screen combines parts of A, B and C.

### Today (first screen)
- **Header:** the weekday and date ("Wed · Sep 30"), then **Recap** and a **☰** menu. The time isn't shown.
- **Calorie counter:** a big "left" number, "X eaten of Calorie Target", and a forecast bar (eaten + rest of today's plan, with a target line).
- **Rebalance button:** a red button ("Rebalance · 195 over") appears only when the day forecast goes over the Calorie Target. No options are shown on the dashboard. Tapping it opens chat, where the Agent asks for the Member's input first ("how are you feeling about the rest of today?"), then offers the options that fit that answer, with "See all options" as well.
- **Day table:** one row per meal slot with planned, eaten and the difference, showing the planned Dish. The **Calorie Log is merged in**: each food logged is listed under its meal with its calories, marked "est." for Agent estimates and "extra" for unplanned items. Rebalanced meals are tagged.
- **Entry bar** (above the tabs, on every page): a **+** button for quick entry (Food Library search and recent foods) next to a **chat box for the Agent**.

### Navigation
- **Bottom tabs:** Today, Plan, Pantry, Grocery, Chat. **Each tab is its own full page**, not a pop-up.
- **Chat tab badge:** a red badge counts what needs the Member: open **Check-ins plus a live Rebalance**. The Chat page starts with a "Needs you (n)" list. Each Check-in has basic quick options (for example "Plan it" / "Not needed") or "Chat about it ›", and the Rebalance item starts the input-first flow. Answering either way clears it and lowers the count. Check-ins are **not** cards on the dashboard.
- **☰ menu:** Favorites and **Settings**. Settings holds the Activity Log, Schedules, Calorie Target, Preferences and Kitchen Tools, and will be designed later. The Activity Log is not on the dashboard.
- **Recap** opens from the header (daily, weekly, monthly or custom).

### Changes to earlier decisions
- #05: Check-ins (including the unbought-ingredient alert) show in chat and on the Chat tab badge, not as dashboard cards.
- #08: the dashboard shows only a Rebalance button. The Agent asks for input before offering options, and the "top 2 options" card is dropped. The Rebalance still appears straight away in the chat reply to the log that caused it.
