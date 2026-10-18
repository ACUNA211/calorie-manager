# 71: Decide: how sign-ups work with invites

**Type:** your task (not for an agent)

**What to do:** Invite links (06) need Supabase's "allow signups" switched on, so anyone who finds the project URL could create an account. Without a Household that account can't see anything. Choose one: (a) turn sign-ups off and create invited people's accounts by hand, (b) leave sign-ups on and accept empty accounts, or (c) have Claude add an Auth hook that rejects a sign-up with no invite token (a new build ticket).

**Blocked by:** None (can start immediately)

**Status:** decided (dashboard check waits on 73)

**Unblocks:** 06

- [x] Option chosen and written in ticket 06's Comments
- [ ] The Supabase dashboard setting matches the choice (once 73 is done)

## Comments

2026-10-17: (a) for now: sign-ups off, accounts by hand. Soft launch → (c) invite-only Auth hook; product → (b) open sign-ups. When 73 is done, check "Allow new users to sign up" is **off** in Supabase → Authentication → Sign In / Providers.
