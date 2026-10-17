# 06: Invite link

**What to build:** The Owner can create an invite link for their Household. Opening it lets a new person sign up (or sign in) and join that Household as a Member. Links expire after 7 days and can be revoked. Sign-ups only happen through invites: there is no open sign-up page.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 05 (Households and Members)

**Status:** ready-for-agent

- [ ] Owner sees "Invite" on the Household page, creates a link and can copy it
- [ ] Someone opening the link signs up and lands in that Household as a Member
- [ ] An expired or revoked link shows a clear message and joins nobody
- [ ] A person already in a Household can't join a second one
- [ ] Only the Owner can create or revoke links (enforced by policy, tested)
