# How do Members sign in?

Type: grilling
Status: resolved
Assignee: ACUNA211
Blocked by:

## Question

How does a Member sign in (email link, password, Google, passkey), and how long do they stay signed in on their phone? Does each Member always use their own device and login, or can a shared device (for example the kitchen laptop) switch between Members? How does the app know whose Calorie Log an entry goes to, and how does the second Member join the Household in phase 3 (an invite)? What can each Member see and edit of the other's data (Calorie Log, Preferences, chat)?

## Answer

**Signing in**
- **Google sign-in only** (Supabase Auth). There's no email code, magic link or password.
- A Member **stays signed in until they sign out** on that device, and Supabase renews the session in the background.
- **No public sign-up.** An email allowlist in the database (one Household, two Members) is edited by hand in Supabase, and any other Google account sees "This app is private." There's no allowlist screen in the app.
- **Each Member uses their own login on their own devices.** There's no Member switcher. On a shared laptop, you sign out and the other Member signs in.
- Whose Calorie Log an entry goes to comes from the signed-in Member, unless it's added through the other-Member page or a confirmed chat card (see below).

**Phase 3: the second Member joins**
- The developer adds her Gmail to the allowlist in Supabase. Her first Google sign-in attaches her to the Household as the second Member.
- Then a first-run setup: language (Spanish), Calorie Target and Preferences. There are no invite links or emails.

**Access: the same both ways, no admin in the app**
- **Everything is visible to both Members**, including each other's chats. Household data (Pantry, Meal Plan, Grocery List, Kitchen Tools, Dishes) is edited by both as usual.
- **Each Member can edit all of the other's data** (Calorie Log, Preferences, Calorie Target, Schedules), but only on a **separate other-Member page under ☰**. It shows her Today view, with a different header colour, her name, and its own + button, so nothing lands in the wrong log by accident.
- **Logging for the other Member from your own chat** is allowed ("Ana had a burger"). The Agent always shows a confirmation card, "Add to [her] Calorie Log?", and nothing lands without that tap.
- Food added for the other Member shows **"added by [name]"** inline, and the owner can edit or delete it. Every change made for the other Member goes into the **Activity Log with "changed by [name]" and undo**. Whether it also sends a push is left to [#14](14-notifications.md).
- A Rebalance triggered by an entry the other Member added goes to the **owner's** Chat badge.
- The only extra power the developer has is the Supabase allowlist.

**Chats**
- There's still one chat per Member (#05). **Both Members can read both chats**, but you can only **post** in the other's chat once you've been added.
- **Ask to join:** a button on the other Member's chat sends a request to the owner's Chat badge, and the owner taps Accept or Decline. Once you're in, your messages show your name, and the Agent answers whoever wrote.
- **Meal Plan auto-add:** when the Meal Plan is drafted or changed in a Member's chat (the Friday planning, a swap), the other Member is added automatically and gets a Chat badge.
- **Being added lasts one conversation.** It ends when either Member taps Leave or Remove, after 30 minutes with no messages, or, for a Meal Plan add, when the plan change is approved or dropped. A small "[name] left the chat" line marks the end.

## Comments

**Grilling (2026-09-30):** Magic links were ruled out because on Android they open in Chrome, not in the installed PWA. The developer wants full transparency: nothing is private between the two Members, and the only guard is against accidental input (a separate page, confirmation cards, and chats you post in only when invited). The use case is logging for her when you're out together and she doesn't have her phone.
