# 35: Research: Jev vs OpenAI Decisions

**What to build:** Test the decision models for Rebalance and Voice commands before building on them. Write 50 realistic messages (25 English, 25 Spanish), half Rebalance ("big lunch at a wedding, way over") and half Voice commands ("tick off the milk"), each labelled with the right answer. Run them through TypeSafe's Jev and OpenAI's Decisions API (and Cloudflare's Clef if available), using typed questions (Choice / Score / yes-no). Confirm prices and limits on the vendors' own pages.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A report in `.scratch/restart/research/` with accuracy, confidence vs correctness, speed and cost per provider and language
- [ ] A pick per language (English, Spanish) for ticket 58
- [ ] The 50 labelled messages are saved so they can be re-run later
- [ ] Total spend recorded (expected under $1)
