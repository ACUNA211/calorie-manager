# 34: Offline logging

**What to build:** Logging on Today works with no signal: entries are queued on the phone and sent when back online, in order. The screen marks entries that haven't synced yet.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 23 (Today: log a food), 03 (Home Screen install and offline app shell), 74 (Phone check: install and offline), 69 (Run the database tests locally)

**Status:** done (awaiting phone check)

- [x] With the network off, logging a food from the Food Library adds it to Today, marked "not synced"
- [x] Turning the network back on sends queued entries and clears the mark
- [x] A queued entry that fails to sync shows an error instead of vanishing
- [x] Searching USDA offline says it needs a connection

## Comments

- 2026-10-17: Built in worktree `t34` (branch `restart-t34`), not pushed. The queue is `web/src/lib/offlineQueue.js` (pure rules, a JSON store on localStorage, `syncQueue` run in order), `web/src/lib/online.js` (`useOnline`), `web/src/lib/useOfflineLog.js` (the React hook: sends when online and every 30 s while online, keeps a copy of the Food Library results seen online for offline search). `LogFoodPanel.jsx` queues a row when there is no connection or the request never gets an answer; `TodayMeals.jsx` marks queued entries "Not synced" and shows Try again and Discard for a refused one. Each queued row carries a `client_id` (uuid made on the phone). Migration `025_calorie_log_client_id.sql` adds `client_id uuid unique` to `calorie_log`; a resent row the server already has is refused with 23505, which `insertQueuedEntry` (`lib/today.js`) reads as sent, so a retry cannot log a food twice. pgTAP test `supabase/tests/calorie_log_client_id_test.sql` (4 checks), not run (ticket 69). Locale keys under `today.offline` in en and es. Storage choice: localStorage, not IndexedDB, because the queue is a few small rows read and written as a whole; if the browser refuses storage, saving throws and the Member sees "Could not keep this entry on the phone".
- Not done here: a refused entry blocks the entries behind it until the Member tries again or discards it (kept in order on purpose). Editing and deleting an entry while offline still need a connection and fail with the usual error. Queued entries are not editable. The page's own sync sends queued entries while Today is mounted, which is always for a signed-in session, since App.jsx renders TodayPage then. A queued entry stays on the phone until the day reloads after it is sent, so a brief flicker is possible.
- Measured in `web/`: `npm run lint` passes; `npm run build` passes; `npm run format:check` passes; `npm test` 47 files, 671 tests pass (`offlineQueue.test.js` 34, `useOfflineLog.test.js` 8, `online.test.js` 6, `TodayOffline.test.jsx` 5, `today.test.js` 18 including 4 for `insertQueuedEntry`). In one earlier full run `RecipeEditor.test.jsx` failed a timing check under load; it passed alone and in the final full run. The four ticked boxes were verified only in jsdom tests with a simulated network and a fake database; nothing ran on a real phone, with a real network drop, or against a database. Not run: the pgTAP test and migration 025 (ticket 69), and the phone check (ticket 74).
- `TodayPage.jsx` change is about 26 added lines, over the ticket's roughly ten: the hook call, the day merge, the toast for a queued row, and the two props on TodayMeals. Ticket 31 may touch the same deps line of the day-loading effect.
