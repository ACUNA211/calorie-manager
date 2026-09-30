# What does the Plan page look like?

Type: prototype
Status: open
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
