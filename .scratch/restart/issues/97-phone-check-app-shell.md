# 97: Phone check: app shell

**Type:** your task (not for an agent)

**What to do:** Ticket 89 gave the app routes, a bottom tab bar, a top bar and a stylesheet, checked only by tests. After it is deployed (or with `npm run dev` in `web/` and your phone on the same network), check on your iPhone, installed to the Home Screen:

1. The "Logging for" picker is in the top bar on every tab (with a Household that has a Dependent).
2. Nothing scrolls sideways and every button is comfortably tappable.
3. Switch the phone to dark mode: the app follows.
4. The tab bar sits clear of the home indicator (this relies on `viewport-fit=cover` in `web/index.html`).
5. Turn on airplane mode and open the app: it still opens (ticket 03's check).

Tick the matching boxes in ticket 89, and note anything off in its Comments.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

**Unblocks:** 89

- [ ] All five checks pass, or what failed is noted in ticket 89
