# 92: Today picks up a new Household without a reload

**What to fix:** After creating a Household, Today, Week and Meal Times keep saying "Join or create a Household first" until the page is reloaded. Found in the ticket 79 review on the local stack, 2026-10-18.

Cause: `HouseholdPage.jsx`'s `onCreated` sets its own state but doesn't call `refreshActingMember()` from `useActingMember()` (`lib/actingMember.jsx`), so the "logging for" picker and every screen that reads the acting Member still see no Household. `reloadHousehold()` in the same file already does it for Dependents. Check that joining through an invite link (`InviteLanding`'s `onJoined` in `App.jsx`) refreshes too.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** None (can start immediately)

**Status:** done (awaiting review)

- [x] Creating a Household makes Today, Week and Meal Times usable straight away
- [x] Joining through an invite does the same
- [x] A test covers the create case with the acting-Member provider in place

## Comments

- 2026-10-18: Written during the ticket 79 review. Belongs to Release 1.
- 2026-10-19: Done. HouseholdPage onCreated and InviteLanding JoinForm now call the acting-Member refresh (invite awaits it before onJoined). Tests: create case with real ActingMemberProvider; invite case checks refresh runs before onJoined. Not checked in a browser against the local stack.
