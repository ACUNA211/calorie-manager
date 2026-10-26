# 61: Voice: Shopping list

**What to build:** Voice commands for the Shopping list: "tick off the milk" or "add bread". The transcript goes to the decision interface with the action list and the current Shopping list lines as choices; code pulls out amounts. The 3 most likely meanings show as option cards; nothing happens until the Member taps one, or they say it again.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 58 (Decision-model interface), 60 (Voice capture), 47 (Bought / Have it), 106 (Phone check: voice commands on the Shopping list)

**Status:** done (awaiting phone check, ticket 106)

- [ ] Tick and add both work from speech, through option cards
- [x] The candidate lines sent are the current unticked lines
- [x] Nothing changes until a card is tapped

**Comments:**
- 2026-10-25: Built `lib/voiceShopping.js` (pure: candidate lines, questions, the add parser, cards), `lib/decide.js` (calls the `decide` Edge Function, `DecideError('cap' | 'failed')`), and `components/ShoppingVoice.jsx`, mounted on `/shopping` under Scan. `VoiceCapture` gained optional `onHeard(transcript)`, `onListen()` and `children`; Today's use is unchanged.
  - How it decides: the transcript is the `state`; two questions go to `decide`: `action` (the six Voice command actions from CONTEXT) and `line` (each open, unticked line as `line_<id>`, plus `none`). Lines ticked or waiting in the offline queue are left out. Lists over 39 lines keep the 39 sharing the most words with what was said (`decide.ts` MAX_OPTIONS raised from 12 to 40 for this).
  - Code pulls out the item and amount for "add" (Jev only picks, it doesn't write): leading and trailing command words are removed in English and Spanish ("add", "añade", "to the list", "a la lista"…), then a number (digits or a word, "half a"/"medio") and an optional unit ("2 litres", "1 docena", "3 latas"). An add becomes a hand line with no food and the amount as text, like the add form without a food.
  - Cards: tick cards score P(action = tick) × P(line); the add card scores P(action = add). The top three at 5% or more show; none → "not a Shopping list command". Tapping uses the page's own `tick(line, 'bought')` and `addLine`, so Undo, the toast and the offline queue behave as with the buttons. A spoken tick is always Bought; "Have it" by voice is not built.
  - Voice needs a connection: offline, the mic is replaced by a note.
  - Tests: `voiceShopping.test.js` (22) and `ShoppingVoice.test.jsx` (7, fake speech recognizer and mocked `decide`). Full suite 1360 passing, lint, format and build pass. NOT RUN: real speech, a deployed `decide`, a browser check (the dev server talks to the live project and needs your sign-in). Known rough edge: when Jev rates "add" as a weak third meaning of a tick command, the add card shows the whole phrase as the item ("Add Tick off the milk to the list").
