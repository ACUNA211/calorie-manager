# 105: Phone check: scanning on the Shopping list

**Type:** your task (not for an agent)

**What to do:** After the database tests pass (ticket 98) and the app runs against a database with migrations 044–047, on your phone open More → Shopping list and tap "Scan a product":

1. Scan a product that has a line on the list: the line ticks Bought at the package's real weight, and the Pantry shows that amount.
2. Scan a product that isn't on the list, accept the offer: the Pantry gains one package, and the message says it wasn't on the list.
3. Scan a barcode no source knows: "Type in the label" appears and works.
4. Decide whether "adds it with a note" should stay an on-screen message (what's built) or be a note stored on the Pantry item (needs a migration).

Note results and the decision in ticket 49's Comments and tick its boxes.

**Blocked by:** 98 (Run the database tests for migrations 035 onward)

**Status:** ready-for-human

**Unblocks:** 49

- [ ] Checks 1–3 pass on the phone
- [ ] Note decision recorded
