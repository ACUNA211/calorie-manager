# 54: Web Push setup

**What to build:** Web Push with VAPID keys: a Member allows notifications, the subscription is saved per device, and a server function can send a notification. A "Send test" button in Settings proves it on Android and on an installed iPhone app.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 03 (Home Screen install and offline app shell)

**Status:** ready-for-agent

- [ ] Allowing notifications saves the device's subscription
- [ ] "Send test" delivers a notification on Android Chrome and on an installed iPhone app
- [ ] Expired subscriptions are removed when sending fails
- [ ] VAPID private key lives only on the server
