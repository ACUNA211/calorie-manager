# Which events send a phone notification?

Type: grilling
Status: resolved
Assignee: ACUNA211
Blocked by:

## Question

Inside the app, Check-ins and a live Rebalance are counted on the Chat tab's badge (#09). Which events should also send a **push notification** to the phone when the app is closed: meal-slot check-ins, a Rebalance proposal, the daily recap, the weekly reflection and planning, "Meal Plan ready to approve", the unbought-ingredient alert, the other Member ticking the Grocery List? What does each one say, and can it be answered from the notification itself? Is there a quiet-hours window or a per-type on/off switch in Settings, and what happens when several fire close together?

## Answer

**Which events send a push**
- **Pushed:** meal-slot Check-ins, a Rebalance proposal, the daily recap (9:30pm), the Friday reflection, "Meal Plan ready to approve", and the unbought-ingredient alert (3pm the day before).
- **Phase 3, also pushed:** Ask to join, Meal Plan auto-add, and food "added by" the other Member to your Calorie Log.
- **Not pushed:** the other Member ticking the Grocery List (it shows live in the app) and anything else. These stay on the Chat badge only.
- **Each Member gets push only for their own events**, never the other Member's. It goes to every device they're signed in on, and answering on one device (or opening the item in the app) clears it on the others.

**What each one says** (in the Member's language, so Spanish for her in phase 3)
| Event | Title | Line | Buttons |
|---|---|---|---|
| Check-in | "Lunch?" | "Planned: chicken rice bowl, 520 kcal" | **Ate as planned** (logs the planned Portion, with undo in the app) / **Something else** (opens Chat) |
| Rebalance | "Today is heading over" | "Forecast 2,150 / 1,900. Tap to rebalance." | tap to open |
| Daily recap | "Your day" | "1,780 / 1,900 kcal. 2 meals still unlogged." (second part only if true) | tap to open |
| Friday reflection | "Weekly reflection is ready" | "Then we'll plan next week." | tap to open |
| Plan ready | "Next week's Meal Plan is ready" | "Tap to review and approve." | tap to open |
| Unbought alert | "Missing for tomorrow" | "Chicken thighs, rice (Tue dinner)" | **Add to Grocery List** / **Open** |
| Ask to join | "[name] wants to join your chat" | | **Accept** / **Decline** |
| Added by other | "[name] added to your log" | "Burger, 750 kcal" | tap opens Today |

Web push can show at most 2 buttons and can't take a typed reply, so anything longer opens the app.

**Settings and defaults**
- **Every push type is on by default.** The system "Allow" prompt, which the browser requires once per device, shows right after the first sign-in on that device, as part of setup.
- **Settings → Notifications** (under ☰) has a switch per push type and one quiet-hours window per Member (10pm–7am by default). Switching a type off stops only the push, and the Chat badge still counts it. If Allow was refused, a line at the top says "Blocked on this device" with steps to fix it.
- **Quiet hours:** a push that falls inside the window waits until it ends, or is dropped if it's stale by then (for example a Check-in for a slot that has passed).

**Timing and pile-ups**
- **One notification per type**, with a newer one replacing the older (tag collapse). Different types show separately. A Rebalance that's replaced or no longer needed is withdrawn from the tray.
- **An ignored Check-in doesn't push again.** It stays on the Chat badge, and the 9:30pm recap asks about meals still unlogged. A Check-in whose meal is already logged in the app is withdrawn or never sent.
- **"Ate as planned" acts like any other log**, so if it pushes the forecast over, a Rebalance push follows as normal.

## Comments

**Grilling (2026-09-30):** The developer wanted everything on automatically. Browsers don't allow that, so every type is on by default and the one system prompt comes during setup, with no extra explainer card.
