# 33: What other Members see

**What to build:** By default, other adult Members see only what's on the shared Meal Plan plus an on-track / over flag per day for you, not your Calorie Log, Targets or weight. A "share everything" switch on your settings lets them see it all. Dependents are always fully visible to adults.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 31 (Week view), 69 (Run the database tests locally), 87 (Decide: what does "share everything" show?)

**Status:** done (awaiting DB test run)

- [ ] Another Member sees only flags for your days unless you share everything (policy tests)
- [ ] Turning on "share everything" shows them your Week view and log
- [ ] Dependents' data is always visible to every adult in the Household

## Comments

- 2026-10-17: Built in worktree `t33` (branch `restart-t33`). Migration `032_member_sharing.sql`: `members.share_everything` (default false), switched by RPC `set_share_everything(p_share)` (own Member only). `private.member_data_readable_ids()` (own and Dependents, plus Members who share everything) now drives the read policies on `calorie_log` and `member_settings` (Targets), and the 030 weight hook `weight_readable_by_caller`. Writes still use `my_member_ids()` only. The split policies are `calorie_log_read`/`_insert`/`_update`/`_delete` and the same for `member_settings`. `public.member_day_flags(member, start, end)` returns only `(day_key, is_over)` per logged day, for any Member of the caller's Household. Audit: the policies from 007, 010, 018, 030 did not over-share to other adults (they used `my_member_ids()`), so nothing was tightened; the one thing left as is is 013's `meal_time_members_select`, where co-sharers of a shared Meal Time see each other's calorie ranges (deliberate in 013, not changed). pgTAP `supabase/tests/member_sharing_test.sql` (23 assertions, NOT run; ticket 69). Web: `lib/sharing.js` (switch, other adults, flags or full week), `lib/sharingLogic.js` (day status, flags to a week, other adults), `components/HouseholdDays.jsx` (on the Week view under the day list: flags per other adult, calories per day only for those who share), `components/SharingSetting.jsx` (the switch, on the Household page). Locale `sharing` in en and es. `WeekPage.jsx` and `HouseholdPage.jsx` each gained two or three lines. Measured in `web/`: `npm run lint` exit 0; `npm run build` exit 0; `npm run format:check` exit 0; `npm test` 64 files, 867 tests pass (4 new files, 23 new tests: sharingLogic 6, sharing 9, SharingSetting 5, HouseholdDays 3). The page tests `WeekPage.test.jsx` and `HouseholdPage.test.jsx` now mock `lib/sharing.js`. The weight-trend case in `WeekPage.test.jsx` now waits for its data (it raced the load and failed once in a full run). Nothing ran against a database or in a browser. Ticked no boxes: the policy box needs the pgTAP run; "shows them your Week view and log" is only partly built (a sharing Member's calories per day show on the Week view of the others, but there is no drill-down into their full Week view or log yet); the Dependents box needs the pgTAP run. Not built: the shared Meal Plan (no table yet; `HouseholdDays` will need its rows when it exists).
