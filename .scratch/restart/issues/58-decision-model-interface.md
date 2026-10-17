# 58: Decision-model interface

**What to build:** One server function for typed decisions: it takes a text state and typed questions (Choice, Score, yes/no) and returns answers with probabilities and confidence. Providers: Jev, OpenAI Decisions and a cheap text model as the last fallback; the provider per language is the one ticket 35 picked. Every call goes through the AI cap helper.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 12 (AI cap counter), 35 (Research: Jev vs OpenAI Decisions)

**Status:** ready-for-agent

- [ ] Switching provider is a setting, not a code change
- [ ] If the main provider errors, the next one is tried
- [ ] Responses are normalised to one shape for every provider (tested with recorded responses)
- [ ] Calls are recorded in the AI ledger
