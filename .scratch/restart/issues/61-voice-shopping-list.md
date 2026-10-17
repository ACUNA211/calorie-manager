# 61: Voice: Shopping list

**What to build:** Voice commands for the Shopping list: "tick off the milk" or "add bread". The transcript goes to the decision interface with the action list and the current Shopping list lines as choices; code pulls out amounts. The 3 most likely meanings show as option cards; nothing happens until the Member taps one, or they say it again.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 58 (Decision-model interface), 60 (Voice capture), 47 (Bought / Have it)

**Status:** ready-for-agent

- [ ] Tick and add both work from speech, through option cards
- [ ] The candidate lines sent are the current unticked lines
- [ ] Nothing changes until a card is tapped
