# 06: Invite link

**What to build:** The Owner can create an invite link for their Household. Opening it lets a new person sign up (or sign in) and join that Household as a Member. Links expire after 7 days and can be revoked. Sign-ups only happen through invites: there is no open sign-up page.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 05 (Households and Members)

**Status:** done (awaiting DB test run)

- [x] Owner sees "Invite" on the Household page, creates a link and can copy it
- [ ] Someone opening the link signs up and lands in that Household as a Member
- [ ] An expired or revoked link shows a clear message and joins nobody
- [ ] A person already in a Household can't join a second one
- [ ] Only the Owner can create or revoke links (enforced by policy, tested)

## Comments

- 2026-10-17: Built in branch restart-t06 (migration 011, invite UI, Vitest). SQL not run: `supabase test db` on a local stack is still needed before ticking the rest of the boxes. Revoke has no UI yet (SQL only). Links are single-use.
- Sign-ups: "allow signups" must stay on in the Supabase dashboard for the invite landing to create accounts, which means anyone who finds the project URL can also sign up and have an account with no Household. Tradeoff: a signup hook could block sign-up unless an invite token is present, but that needs a server-side check on an Edge Function or Auth hook. Options: (a) turn signups off and create invited accounts by hand, (b) keep signups on and rely on the Member-less account being useless (no Household data is readable), or (c) add an Auth hook that rejects signups with no invite. Decide before the app is shared beyond the Household.
