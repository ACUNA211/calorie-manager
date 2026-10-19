# 71: Decide: how sign-ups work with invites

**Type:** your task (not for an agent)

**What to do:** Invite links (06) need Supabase's "allow signups" switched on, so anyone who finds the project URL could create an account. Without a Household that account can't see anything. Choose one: (a) turn sign-ups off and create invited people's accounts by hand, (b) leave sign-ups on and accept empty accounts, or (c) have Claude add an Auth hook that rejects a sign-up with no invite token (a new build ticket).

**Blocked by:** None (can start immediately)

**Status:** done

**Unblocks:** 06

- [x] Option chosen and written in ticket 06's Comments
- [x] The Supabase dashboard setting matches the choice (once 73 is done)

## Comments

2026-10-17: (a) for now: sign-ups off, accounts by hand. Soft launch → (c) invite-only Auth hook; product → (b) open sign-ups. When 73 is done, check "Allow new users to sign up" is **off** in Supabase → Authentication → Sign In / Providers.

2026-10-18: Checked live (`/auth/v1/settings`): `disable_signup` is **false**, so sign-ups are still on. Needs switching off in the dashboard; the app has no `signUp` call, so nothing breaks.

2026-10-18: Rechecked live: `disable_signup` is **true**. Sign-ups are off; ticket done.
