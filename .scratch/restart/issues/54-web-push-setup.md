# 54: Web Push setup

**What to build:** Web Push with VAPID keys: a Member allows notifications, the subscription is saved per device, and a server function can send a notification. A "Send test" button in Settings proves it on Android and on an installed iPhone app.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 03 (Home Screen install and offline app shell)

**Status:** done (awaiting you: create the VAPID keys and set them, deploy migration 043 and the send-push function, then test on an Android phone and an installed iPhone; steps in Comments)

- [ ] Allowing notifications saves the device's subscription
- [ ] "Send test" delivers a notification on Android Chrome and on an installed iPhone app
- [x] Expired subscriptions are removed when sending fails
- [x] VAPID private key lives only on the server

## Comments

- 2026-10-19: Built. Migration 043 (`push_subscriptions`, one row per device; `save_push_subscription()` saves for the signed-in Member and moves a device to whoever signs in on it; a Member reads and deletes only their own rows) with pgTAP `push_subscriptions_test.sql` (written, NOT run: no Supabase CLI or Docker engine on this machine). Edge Function `send-push` (shared code in `_shared/send-push.ts` and `_shared/web-push.ts`): a signed-in Member's call notifies only their own devices; a caller holding the service-role key (tickets 55 and 56) may pass `memberIds`. 404 and 410 from the push service delete the row; any other status keeps it. Web Push is hand-built on WebCrypto and fetch (VAPID ES256 plus aes128gcm), so it needs no Node compatibility in Deno. Measured in Node: the encrypted body decrypts with the reference `http_ece` library and the VAPID token verifies against a key pair made by the reference `web-push` 3.6.7. Not measured: running inside Deno / Supabase Edge (no Deno installed). Service worker: `public/push-sw.js` (push and notificationclick) pulled in by `importScripts` in the generated worker; the build emits `sw.js` with 17 precache entries (push-sw.js is one) and the navigation fallback. Settings > Notifications: Turn on, Send test, Turn off, and a Home Screen note on iPhone with Apple's WebKit page (https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/: Web Push needs the app on the Home Screen, iOS/iPadOS 16.4+). Boxes 1 and 2 are left unticked: box 1 is only unit-tested with fakes (no live database or browser), box 2 needs devices. Tickets 55 and 56: call `send-push` with the service-role key as the Bearer token and `{ memberIds, title, body, url }`; if the project uses new-style secret keys that are not JWTs, redeploy with `--no-verify-jwt` and keep the key check in the handler.
- To finish (you): 1) `npx web-push generate-vapid-keys`. 2) Put the public key in `web/.env.local` as `VITE_VAPID_PUBLIC_KEY=...` and in the host's build variables. 3) `supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com`. 4) `supabase db push` (migration 043) and `supabase functions deploy send-push`. 5) Optionally `supabase test db` for the pgTAP file. 6) On Android Chrome and an iPhone with the app on the Home Screen: Settings > Notifications > Turn on > Send test.
