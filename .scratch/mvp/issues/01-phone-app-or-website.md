# Phone app or website?

Type: grilling
Status: resolved
Blocked by:

## Question

For the MVP, should this be an installable web app (a website that also sits on your phone's home screen), a native phone app (iOS, Android or both), or both? Both Members will mostly use it on their phones, with dashboards they can read at a glance. What platforms do the two of you use, and what would a native app give you that an installable web app wouldn't?

## Comments

**Handoff (2026-09-27):** A grilling round was asked but not yet answered. Re-ask it. Background: a native iPhone app for two people means a paid Apple developer account ($99/yr) or reinstalling every 7 days; an installable web app works on iPhone and Android, including push notifications (iOS 16.4+).

1. Which phones do the two Members have: iPhone, Android, or mixed?
2. Is any native-only feature a must-have for the MVP (home-screen widgets, Apple Health / Google Fit, reliable background work)? Recommended: none.
3. Will you also use it on a laptop (planning the week, editing the Grocery List)? Recommended: yes, sometimes.
4. Installable web app now vs. native app (Expo / React Native) from day one vs. both? Recommended: installable web app now; native only if something's missing later.

## Answer

**An installable web app (PWA). No native app.** Both Members use Android phones. None of the native-only features (home-screen widgets, Apple Health / Google Fit, reliable background work) are needed for the MVP. Design phone-first, but the app must also work fully in a laptop browser, where the primary Member will plan the week and edit the Grocery List. Revisit a native app (Expo / React Native) only if something turns out to be missing.
