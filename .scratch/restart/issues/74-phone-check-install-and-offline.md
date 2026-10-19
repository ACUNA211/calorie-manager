# 74: Phone check: install and offline

**Type:** your task (not for an agent)

**What to do:** On the deployed URL: Chrome DevTools or Lighthouse reports the app as installable. Install it on an Android phone, open it once online, turn on airplane mode and reopen it: the shell shows, not a browser error. On an iPhone in Safari (iOS 16.4+), the "Add to Home Screen" hint shows once and stays hidden after "Got it" and a reload. After a new deploy, the next open runs the new version.

**Blocked by:** 73 (Deploy the app to Cloudflare Pages)

**Status:** done

**Unblocks:** 03

- [x] Installable
- [x] Opens offline
- [x] iPhone hint shows once
- [x] New deploy picked up
- [x] Tick the boxes on ticket 03

## Comments

- 2026-10-18: Sergio checked all four on the deployed URL and his phones. Ticked the boxes on ticket 03.
