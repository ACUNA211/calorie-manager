# 47: Bought / Have it

**What to build:** Each Shopping list line has two ticks: **Bought** adds its amount to the Pantry, **Have it** corrects the Pantry to say the needed amount is there. Ticked lines move to a done section and are never unticked.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 46 (Shopping list from approve)

**Status:** done (awaiting you to run `supabase db reset` then `supabase test db` on a local stack, which checks migration 046 and shopping_ticks_test.sql, then tick the first two boxes)

- [ ] Bought adds the line's grams to the Pantry
- [ ] Have it sets the Pantry to at least the needed amount
- [x] Ticked lines move to done; Undo is available for a few seconds

## Comments

- 2026-10-19: Done on branch restart-t47. Migration 046: `shopping_tick(line, kind, grams)` (kind `bought` or `have_it`; optional grams is for ticket 49's scanned weight) and `shopping_untick(line)`, both security definer and Household-checked. A tick updates the Pantry and the line in one transaction and records what it changed in the new `shopping_ticks` table; ticking a line already ticked changes nothing (`applied: false`), which keeps queued or double ticks from doubling the Pantry (tickets 48, 49). Undo is allowed 10 s after the tick (the toast shows for 5 s), takes back exactly the amount the tick added, and a trigger stops any other route from unticking a line. Client: `tickLine` and `untickLine` in `lib/shopping.js`, one call per tick; pure rules in `lib/shoppingLogic.js`. The screen has the two ticks per line (a hand-added line with no food gets one), a Done move and the Undo toast. Web lint, build, format and 1226 Vitest tests pass; the third box is ticked from component tests. The first two boxes are NOT ticked: `supabase/tests/shopping_ticks_test.sql` (23 checks) was written but not run, as no local Supabase stack was available.
