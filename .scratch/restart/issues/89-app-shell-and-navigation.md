# 89: App shell and navigation

**What to build:** Turn the one long page into an app. Today every screen is stacked in `web/src/App.jsx` with no CSS at all, so it can't be used on a phone. Give it:

- **One screen per route:** Today, Week, Foods, Pantry, Recipes, and More (the Settings screen, ticket 91). Signed-in users land on Today. Routes survive a reload and the back button works. Cloudflare Pages serves `index.html` for unknown paths, so plain path routes are fine.
- **A bottom tab bar** with those six, icon plus label, fixed to the bottom, clear of the iPhone home indicator (`env(safe-area-inset-bottom)`) when installed to the Home Screen.
- **A top bar** with the screen title and the "Logging for" picker (`LoggingForSwitch`). The English/Español switch moves to More.
- **A base style** in one stylesheet with colour, type and spacing tokens on `:root`, a dark version under `prefers-color-scheme: dark`, and shared styles for buttons, inputs, lists, cards, panels and the toast. Tap targets at least 44 px, inputs 16 px or larger so iPhone Safari doesn't zoom, no sideways scrolling at 375 px wide. The look follows the old prototypes on `main` (see ticket 90), so start from their colours and type.
- **Week → Today:** tapping a day on Week opens the Today tab on that day (today it sets `selectedDay` in `App.jsx`).
- **Sign-in and invite screens** get the same base style.

The sign-in, invite, offline and install-hint behaviour must not change. This ticket doesn't re-lay-out each screen's contents (ticket 90) or move settings out of the screens (ticket 91); it gives them a frame and a base style.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 02 (App skeleton and sign-in), 03 (Home Screen install and offline app shell)

**Status:** ready-for-agent

- [ ] Each screen is its own route; reload and back keep you on it
- [ ] The bottom tab bar switches screens and shows which one is open
- [ ] The "Logging for" picker is in the top bar on every screen
- [ ] At 375 px wide nothing scrolls sideways and every control is at least 44 px tall
- [ ] Dark mode follows the phone's setting
- [ ] Tapping a day on Week opens Today on that day
- [ ] The service worker still opens the app offline (ticket 03's check)
- [ ] Existing Vitest suites pass; page tests that render `App` are updated for routes

## Comments

- 2026-10-18: Written during the ticket 79 review. On the local stack every screen sat on one unstyled page; no ticket covered styling or navigation, even though `research/built-vs-restart.md` says the old design tickets' layouts carry over. Belongs to Release 1.
