# 106: Phone check: voice commands on the Shopping list

**Type:** your task (not for an agent)

**What to do:** After `decide` is deployed with your TypeSafe key (ticket 83) and the mic works on your phone (ticket 101), open More → Shopping list on the phone with a few open lines and tap "Start speaking":

1. Say "tick off the milk" (or a line you have). A card "Bought: Milk" shows, and nothing changes until you tap it. Tap it: the line moves to Done and the Undo toast shows.
2. Say "add two litres of orange juice". A card "Add Orange juice (2 litres) to the list" shows. Tap it: the line appears.
3. Switch the app to Spanish and say "marca el pan como comprado" and "añade una docena de huevos". The same cards show, in Spanish.
4. Say something that isn't about shopping ("I ate an apple"): the app says it wasn't a Shopping list command.
5. Turn on airplane mode: the mic is replaced by "Voice commands need a connection."

Note anything Jev got wrong (the words, the card it showed) in ticket 61's Comments and tick its boxes.

**Blocked by:** 83 (Deploy the Edge Functions and set their secrets), 101 (Phone check: voice capture)

**Status:** ready-for-human

**Unblocks:** 61

- [ ] Checks 1–5 pass on the phone, in English and Spanish
