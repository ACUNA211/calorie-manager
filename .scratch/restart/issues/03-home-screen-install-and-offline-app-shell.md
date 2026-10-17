# 03: Home Screen install and offline app shell

**What to build:** Make the app an installable PWA: a web app manifest (name, icons, theme colour) and a service worker that caches the app shell, so it opens with no signal and can be added to the Home Screen on Android (Chrome) and iPhone (Safari, iOS 16.4+). On iPhone, show a one-time hint explaining Share → Add to Home Screen, because push reminders later only work when installed.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 02 (App skeleton and sign-in)

**Status:** ready-for-agent

- [ ] Lighthouse (or Chrome DevTools) reports the app as installable
- [ ] With the network off, an installed app still opens to its shell instead of a browser error
- [ ] On iPhone Safari (not installed), a dismissable "Add to Home Screen" hint appears once
- [ ] A new deploy is picked up on next open (no stale shell forever)
