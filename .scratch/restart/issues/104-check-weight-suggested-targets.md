# 104: Check and decide: Targets suggested after a new weight

**Type:** your task (not for an agent)

**What to do:** Ticket 65 offers "Update your Targets?" after a Member logs a new weight. With the app running (local stack via ticket 98, or deployed):

1. As a Member who has filled in the Intake form, log a weight on Week, press Yes, and check the new Targets on More → Calorie Targets. Log another and press No: Targets stay.
2. Decide the trigger: it appears when the rounded Calorie Target or protein floor would change. Keep that, or offer it when any of the six figures would change?
3. Decide whether editing an existing weight entry should also offer it (today only a new, newest entry does).
4. Read the Spanish wording (`weightSuggest` in `web/src/locales/es.json`).

Note answers and anything off in ticket 65's Comments.

**Blocked by:** 98 (Run the database tests for migrations 035 onward)

**Status:** ready-for-human

**Unblocks:** 65

- [ ] Yes and No behave as described in the app
- [ ] Trigger and edit-entry decisions noted
- [ ] Spanish wording reviewed
