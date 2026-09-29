# What does the Agent do on its own vs. when asked?

Type: grilling
Status: resolved
Blocked by:

## Question

Members can chat with the Agent. Beyond chat, which actions does it take by itself, and on what trigger? Candidates:
- Drafting next week's Meal Plan (on a schedule, or on request?)
- Rebalancing after an overage (automatically when a log pushes you over, or when you ask?)
- The weekly reflection
- Suggesting Grocery List items

Which of its changes apply straight away, and which wait for a Member to approve them? What can it change through chat (log food, edit the Pantry, edit the plan)? Is there one shared chat, or one per Member?

## Comments

**Input from #03/#04 (2026-09-27), requirements already decided:**
- **Day recap:** an end-of-day check-in from the Agent. It asks whether each planned meal was cooked (a yes subtracts its ingredients from the Pantry), asks "Any leftovers?", and offers to plan leftovers into a later meal for a chosen Member. See [04-pantry-precision.md](04-pantry-precision.md).
- Pantry quick-add: the Agent parses free text into a labelled list and **asks for confirmation** before adding.
- Food logged outside the Meal Plan: the Agent asks "Was this from the Pantry?" unless the answer is obvious.
- The Agent may suggest blending in a soft dislike when there's a good reason, and always says so openly. It never suggests anything that breaks a hard rule. See [03-calorie-target-and-preference-rules.md](03-calorie-target-and-preference-rules.md).
- MVP has one Member, so "one shared chat vs. one per Member" only matters from phase 3.

## Answer

**Rule of thumb:** anything a Member tells the Agent to do happens straight away, with an undo. Anything the Agent came up with itself waits for the Member's yes. Nothing is approved automatically.

### Schedules
- Every schedule is an editable setting. Members change it on a Schedules screen, or by asking the Agent in chat ("move my planning to Saturday at 10"). No developer is needed to change one.
- Each Member has a time zone setting (both are on Central Time today). Schedules follow local time through daylight-saving changes.
- Scheduled jobs run on the server even when the app is closed.
- **MVP defaults:**
  - **Weekly, Friday 3pm:** reflection first (how the week went, whether the Member kept to the plan, quick recommendations), then "Ready to plan next week?" The Agent drafts the Meal Plan, which the Member approves whenever they're ready. The Grocery List is updated once the plan is approved. If planning hasn't started by 7pm, the Agent sends one reminder.
  - **Daily recap, 9:30pm:** a summary of the day, whether each planned meal was cooked, "Any leftovers?", and feedback on any new dish.
  - **Monthly recap:** off by default, and can be turned on. **Custom-range recap:** on request ("how did I do in March?").
  - **Meal slots:** breakfast 8:00, lunch 12:00, dinner 18:00. If nothing is logged 2 hours after a slot, the Agent checks in ("Have you eaten lunch yet? What did you have?"). Each slot's check-in can be turned off.
- Each recap is a dashboard (calories, plus weight from phase 2) with a few quick AI recommendations. What exactly it shows is still open (see the map).

### What the Agent may change

| Action | Behaviour |
|---|---|
| Log food the Member says they ate | Applied straight away, shown with its calories, one-tap undo |
| Pantry quick-add | Asks for confirmation first (#04) |
| Pantry edit the Member asks for ("we're out of rice") | Applied straight away, with undo |
| Meal Plan edit the Member asks for ("swap Tuesday dinner for tacos") | Applied straight away, with undo |
| Add to the Grocery List at the Member's request | Applied straight away |
| Any change the Agent itself suggests (including a Rebalance) | Waits for the Member's approval |
| Change the Calorie Target | Not possible through chat; only on the settings screen |
| Add to Preferences or Favorites | Always asks first; never silent |

- **Activity log:** every change the Agent makes is listed with a timestamp and an undo. The reflection also uses it to show whether the Member is keeping to the plan.

### Rebalance: trigger and approval
- **Trigger: the day forecast.** The Agent proposes a Rebalance when calories already logged today plus the remaining planned meals come to more than the Calorie Target. Staying in the deficit is what matters most. A meal going over its own share doesn't start a Rebalance if the day still ends up under the target.
- **Propose only.** The Agent says what caused it ("Lunch was 300 over"), proposes a smaller Portion and says how big it is, and offers other options. The Member can push back ("I don't think that's enough"), ask "Is that enough?", or pick another option. Nothing changes until they choose.
- Details (what can change, shared meals, Pantry-only, when no plan can get them back under) are in #08.

### The Agent's follow-up questions
- The Agent brings things up on its own: leftovers after a meal is cooked, a skipped meal, an ingredient not yet bought, and from phase 2 a missed weigh-in or workouts falling off ("Are you hurt? Should I plan around it for the coming weeks?").
- They come up inside chat replies, at most one per reply, and also appear as dashboard cards. A check-in the Member dismisses doesn't come back for that same event.
- Phone notifications are still an open item on the map.

### Grocery List: always live
- There is always one current Grocery List. Anything added through chat or by hand goes straight on, labelled as added by the Member with the date. The Member may shop more than once a week.
- Approving a Meal Plan merges its Missing Ingredients and the Agent's suggestions (unticked by default) into that same list.
- The weekly reflection asks about items the Member added themselves ("You added chickpeas. Want dishes that use them, or did you have something in mind?").
- **Unbought-ingredient alert:** if a planned meal needs something that isn't in the Pantry and is still unticked on the Grocery List, the Agent warns at **3pm the day before** that meal, both as a dashboard card and in chat. Ticking the item clears the alert. If it's still missing on the day, the Agent proposes a swap using what's in the Pantry.

### Taste: feedback, Preferences and Favorites
- Feedback is about **dishes** (ingredients and amounts, no cooking steps). Recipes with steps are a future phase.
- When a Member says they disliked something, the Agent asks how to save it: **Restriction** (a hard dislike), **Dislike** (a soft dislike), or **Just this dish** (a note on that dish only, no rule).
- **Favorites** can be dishes and ingredients. A Member stars them by hand, or the Agent asks "Add to Favorites?" after a high rating.
- Ratings, feedback notes and Favorites are stored in the database, where Members can see and edit them. Weekly planning mixes Favorites with new dishes and asks for confirmation. If the Member says no, it asks "What do you want to change?"

### Chat
- One chat per Member, with its history saved to that Member's account. In the MVP there's only one.

### Later
- Budget tracking: phase 3 or 4.
- Recipes with cooking steps: future.
