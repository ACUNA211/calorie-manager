# What does the Plan page look like?

Type: prototype
Status: superseded
Assignee: ACUNA211
Blocked by:

## Question

Make a rough mock-up of the Plan tab (#09) and react to it. #06 set the content: Monday to Sunday with four slots a day, each meal's calories against its share, Eating Out, Busy Day and Open slots, a ⏱ badge for meals over their time limit, a Missing Ingredients badge per meal ("Needs: salmon · on Grocery List" / "bought ✓") plus a total, planned leftovers ("from Sunday's dinner"), the weekend Prep Session, and day totals that turn red when over. Is the week a grid, a list of days, or one day at a time on a phone? How does Friday's draft (#05) look before approval, and where is the approve button? After approval, how is "what changed" shown? How are meals swapped (3 alternatives), edited, moved or cleared on the page without chat? How does the Plan page show next week alongside this week?

## Comments

**Prototype (2026-09-30):** `prototypes/21-plan-page-PROTOTYPE.html` (throwaway, also linked from the GitHub Pages index). It has three layouts of the Plan tab, switchable with `?variant=A|B|C` or the ← → keys. Swap (3 alternatives, Pantry first after approval), Edit (amounts with live calories), Move (tap a slot, the two meals trade places) and Clear (becomes Open) all work in every layout, with Undo, and day totals turn red over 2,000.
- **A, week grid:** days as rows and slots as columns, with a This week / Next week toggle. Each cell has icons (↺ leftover, 🍳 Prep Session, ★ new, ⏱, 🛒, ✓ logged), and an orange dot marks a meal changed since approval. "N changes since approval" opens the list. The draft has a yellow banner listing what the reflection changed, and a sticky Approve bar.
- **B, list of days:** one long scroll. Past days fold into one line. Each meal shows everything inline, and a changed meal shows the old Dish struck through above the new one. Next week's draft follows below a divider, with an Approve card at the end plus a sticky Approve button.
- **C, one day at a time:** a 14-day strip across both weeks (draft days in yellow, dots for changes, 🛒 and over-target days), big meal cards with Swap / Edit / Move / Clear buttons, and a draft review screen (what changed from the reflection, a day-by-day dinner table, Missing Ingredients and the Prep Session), then Approve.

Scenario: Fri Oct 2, 3:40pm, after the reflection in #15. This week (Sep 28 – Oct 4) has 4 changes since approval. Next week's draft uses the 4 accepted recommendations (weekday sweet snack, no salmon, a chickpea Dish, pizza night aim 1,000 with a lighter Friday lunch).

**Open question the prototype raises:** a Sunday Prep Session that cooks for next week's lunches and snacks falls in *this* week. In the prototype, next week's draft adds it to this Sunday, and approving the draft confirms it. Is that right, or should the Prep Session belong to the week it feeds?

Waiting for the Member's reaction.

**Feedback round 1 (2026-09-30):** A works as the week overview, and C works for looking at one day in detail and changing it. Also wanted: colour coding for the same food, to help plan meal prep. These are combined into variant D (now the default):
- **Week grid (A) is the Plan page.** Tapping a day name or a meal opens that day in C's view (the 14-day strip, big meal cards with Swap / Edit / Move / Clear, and next / previous day). "‹ Week" goes back to the grid.
- **Batch colours:** every Dish that shows up more than once in the week gets its own colour, in the grid (a tinted cell with a stripe down the left) and on the day view's meal cards (a coloured left edge). The meal where it's cooked is darker with 🔥, and the leftovers and prepped portions are lighter. A "Batches to prep" legend under the grid lists each batch: where it's cooked and which meals it feeds. Tapping a batch highlights it and fades the rest of the grid. A colour switch offers Batches (default: Dishes with leftovers or Prep Session portions), All repeats (also things like yogurt five days a week), or Off.
- **A leftover left without a source:** if the meal that cooks a batch is swapped or cleared, its leftovers get ⚠️ in the grid, and the day view says nothing cooks them any more.

**Feedback round 2 (2026-09-30):** The week runs **Sunday to Saturday** instead of Monday to Sunday (#06 and the map are updated). This settles the Prep Session question from the first prototype comment: the Sunday Prep Session is the first day of the week it cooks for, so it belongs to that week's plan and is approved with it. In the prototype, this week is Sep 27 – Oct 3 (Sunday's Prep Session made the chili for Sunday dinner and Mon/Wed lunch), and next week's draft is Oct 4 – 10, with its own Prep Session on Sunday Oct 4. The catch: after Friday 3pm planning, only Saturday is left to shop, and the unbought-ingredient alert for Sunday's Prep Session comes Saturday at 3pm.

**Feedback round 3 (2026-09-30):** Planning stays **Friday at 3pm** (#05 unchanged). Saturday is the one shopping day, so the prototype now shows it:
- **"Shop Saturday" card** under next week's draft banner (and after approval): lists the Missing Ingredients needed Sunday, meaning Sunday's meals plus anything cooked at the Prep Session (e.g. berries, coconut milk). Before approval it says they go on the Grocery List when you approve; after, it says you'll get an alert if they aren't ticked off by Saturday 3pm.
- **🛒 Shop on Saturday** in the grid, and a shopping-day card on Saturday's day view. While next week is still a draft, it nudges you to approve today so you can shop tomorrow.
- The approve bar says Saturday is the only day to shop before the Prep Session, and the approve toast ends with "Shop tomorrow: … needed Sunday."

**Superseded (2026-10-01):** the MVP was re-charted as a smaller map: [Calorie Manager MVP (reset)](../../mvp-reset/map.md). Kept for reference.
