# 35: Research: Jev vs OpenAI Decisions

**What to build:** Test the decision models for Rebalance and Voice commands before building on them. Write 50 realistic messages (25 English, 25 Spanish), half Rebalance ("big lunch at a wedding, way over") and half Voice commands ("tick off the milk"), each labelled with the right answer. Run them through TypeSafe's Jev and OpenAI's Decisions API (and Cloudflare's Clef if available), using typed questions (Choice / Score / yes-no). Confirm prices and limits on the vendors' own pages.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 76 (Get API keys and run the research tests)

**Status:** done (awaiting review)

- [x] A report in `.scratch/restart/research/` with accuracy, confidence vs correctness, speed and cost per provider and language
- [x] A pick per language (English, Spanish) for ticket 58
- [x] The 50 labelled messages are saved so they can be re-run later
- [x] Total spend recorded (expected under $1)

**Comments:**
- 2026-10-17: 50 labelled messages (25 EN, 25 ES; 25 Rebalance, 25 Voice) saved in `.scratch/restart/research/decisions-test/messages.json`, with a runner (`run-decisions-test.mjs`, dry run passes). Vendor check in `.scratch/restart/research/jev-vs-openai.md`: Jev price $0.042/M input (free output) and OpenAI Decisions $0.10/M input confirmed on vendor pages; Clef not confirmed (Cloudflare page 404). No API keys, so no live runs, no accuracy numbers, no pick per language. Spend $0.
- 2026-10-25: Jev run done by the user (TypeSafe key only). The runner's Jev adapter was rewritten to the documented API (`POST https://api.typesafe.ai/v1/systemone`, `{ model, state, questions }`, choice/score `criteria`, answers keyed by name) and the endpoint is now built in. Results: 128/150 answers right (EN 87%, ES 84%), 0 errors, median 128 ms, spend about $0.0012. `over_by` is 48% exact but 96% within one level; the stated number replaces it in ticket 59 anyway. Confidence below 0.6 was always wrong on choice questions, so 0.6 is the clarifying-question threshold. **Pick: Jev for English and Spanish.** OpenAI Decisions was not run (no head-to-head); it stays the fallback. Ticket 58 should put the day's Plan and the Calorie Target in `state`. Report: `research/jev-vs-openai.md` § Results.
