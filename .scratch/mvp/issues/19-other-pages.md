# Which of the other pages need a prototype?

Type: grilling
Status: resolved
Assignee: ACUNA211
Blocked by:

## Question

The bottom tabs Plan, Pantry, Grocery and Chat each open a full page (#09), and Settings under ☰ (Activity Log, Schedules, Calorie Target, Preferences, Kitchen Tools, Notifications from #14, Agent notes from #16, and editing the other Member's data from #13) hasn't been designed yet. For each page, are #04–#08 and #13–#16 enough to build from, or does it need a rough prototype first? Settle the layout questions the tickets leave open for each page. For example: does Plan show the week as a grid or a list of days, and where do the "what changed" marks after approval go? How does the Pantry show exact amounts next to have / low / out staples? What does the Grocery List look like when it's used offline in the store? How is Settings grouped? Split any page that needs a prototype into its own ticket.

## Answer

Every page is checked against the resolved tickets. The four pages people use every day get a prototype, and Settings is mostly forms, so it gets a grilling instead.

| Page | Already settled by | Still open | Next step |
|---|---|---|---|
| **Plan** | #06 (slots, shares, Eating Out / Busy Day / Open, ⏱ badge, Missing Ingredients badge, editing, "what changed"), #05 (Friday draft and approval) | Week layout, how a draft looks next to an approved plan, where the badges and the "what changed" marks go, the approve button, and editing on the page | Prototype: [#21](21-plan-page.md) |
| **Pantry** | #04 (exact amounts vs. have / low / out, grams plus a kitchen measure, quick-add, cooking and leftovers) | Grouping, how exact items and staples sit together, leftovers as portions, and editing an amount | Prototype: [#22](22-pantry-page.md) |
| **Grocery** | #07 (measures, store sections, combined lines, ticking and remainder lines, midnight clear, offline, chat, Other), #05 (always live, unbought alert) | Ticking and editing the amount one-handed in the store, the offline state, the Agent's suggestion lines, and the "for: …" expand | Prototype: [#23](23-grocery-page.md) |
| **Chat** | #05 (one chat per Member, Agent suggestions wait for a yes), #08 (Rebalance options), #09 (badge), #13 (reading the other chat, Ask to join), #14 (Check-in answers) | The "Needs you" list, how Check-ins, Rebalance options and suggestions show as cards, undo in chat, and the other Member's chat. It shares its cards with #20 | Prototype: [#24](24-chat-page.md), after #20 |
| **Settings (☰)** | #05 (Schedules, Activity Log with undo), #03 (Calorie Target, Preferences), #07 (Kitchen Tools), #13 (the other-Member page), #14 (Notifications), #16 (Agent notes), #17 (usage ledger) | Grouping, where Favorites and Dish feedback live, the Activity Log's layout and filters, and editing the meal split and the 95% | Grilling: [#25](25-settings.md) |

**No ticket needed:**
- **Other-Member page**: #13 already says it's her Today view with a different header colour, her name and its own + button.
- **Stats**: prototyped in #15.
