# 102: Set up Web Push keys, deploy and test on phones

**Type:** your task (not for an agent)

**What to do:** Ticket 54 built Web Push (migration 043, the `send-push` Edge Function, Settings → Notifications with "Send test"). Keys go in your environment and Supabase secrets only, never in a committed file.

1. Make a VAPID key pair: `npx web-push generate-vapid-keys`.
2. Put the public key in `web/.env.local` (gitignored) as `VITE_VAPID_PUBLIC_KEY=<public key>`, and add the same variable to the Cloudflare Pages build settings.
3. `supabase secrets set VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> VAPID_SUBJECT=mailto:<an address you choose>`.
4. After the database tests pass (ticket 98 now includes `push_subscriptions_test.sql`), `supabase db push`, then `supabase functions deploy send-push`. If your project's service key isn't a JWT (new-style secret keys), deploy with `--no-verify-jwt`; the function checks the key itself, and tickets 55 and 56 rely on that.
5. On Android Chrome, and on an iPhone with the app added to the Home Screen (iOS 16.4 or later), open More → Notifications → Turn on → Send test. Tick ticket 54's two open boxes when both arrive.

**Blocked by:** 98 (Run the database tests for migrations 035 onward)

**Status:** ready-for-human

**Unblocks:** 54

- [ ] Keys set (public in env and Pages, private only in Supabase secrets)
- [ ] `send-push` deployed
- [ ] Test notification arrives on Android and on iPhone
