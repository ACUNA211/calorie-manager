# 48: Hand-added lines and offline ticking

**What to build:** Members can add any line by hand (food or not, with an optional amount). Ticking and adding lines works with no signal and syncs later, using the same queue as ticket 34.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 46 (Shopping list from approve), 34 (Offline logging), 98 (Run the database tests for migrations 035 onward)

**Status:** done (awaiting you to run `supabase db reset` then `supabase test db` on a local stack, which checks migration 047 and shopping_hand_lines_test.sql, then tick the first and third boxes)

- [ ] A hand-added line appears for every Member
- [x] With the network off, ticking and adding lines work and sync when back online
- [ ] Two Members ticking the same line offline doesn't double the Pantry amount

## Comments

- 2026-10-19: Done on branch restart-t48. Migration 047: `grocery_list.client_id` and `shopping_add_line(client_id, name, food, grams, text)`, a hand line for the caller's Household; sending the same client_id again returns the existing line (`created: false`). Client: `addHandLine` and `sendShoppingOp` in `lib/shopping.js`; `queuedOp` in `offlineQueue.js` (the ticket 34 queue; `syncQueue` now also passes the item to `send`, nothing else changed) with its own storage key; `lib/useOfflineShopping.js` gives `tick(lineId, kind, grams)` as the one call for ticking (ticket 49's scan can call it with the scanned weight) and `add`. A tick or add with no connection, or whose request gets no answer, is kept on the phone, shown ticked or added with "Not synced", and sent in order when back online; Undo on the toast removes a queued tick; a refused one shows Try again and Discard. The last list seen online is kept on the phone so the page opens with no signal. Add form (`ShoppingAddForm.jsx`): free text or a food from the Food Library (offline, from the foods kept by Today's search), optional amount (grams with a food, free text without). A queued add has no tick buttons until it is sent. Two Members ticking one line offline: the second replay returns `applied: false` from 046, so the Pantry is added to once. Tests: `shopping_hand_lines_test.sql` (20 checks), NOT run (no local Supabase stack). A tick error with no code now counts as no connection (ticket 34 rule), so the existing 'tick fails' test uses a refusal code.
- Measured in `web/`: `npm run lint`, `npm run build`, `npm run format:check` pass; `npm test` 98 files, 1282 tests pass. Boxes 1 and 3 need the database tests (the replay is proved in `shoppingQueue.test.js` against a fake database only). Box 2 is ticked from jsdom tests with a faked network (`ShoppingOffline.test.jsx`); nothing ran on a real phone.
