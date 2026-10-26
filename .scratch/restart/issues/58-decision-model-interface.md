# 58: Decision-model interface

**What to build:** One server function for typed decisions: it takes a text state and typed questions (Choice, Score, yes/no) and returns answers with probabilities and confidence. Providers: Jev, OpenAI Decisions and a cheap text model as the last fallback; the provider per language is the one ticket 35 picked. Every call goes through the AI cap helper.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 12 (AI cap counter), 35 (Research: Jev vs OpenAI Decisions), 83 (Deploy the Edge Functions and set their secrets)

**Status:** done (awaiting you: set `TYPESAFE_API_KEY` as a Supabase secret and deploy `decide`, ticket 83)

- [x] Switching provider is a setting, not a code change
- [x] If the main provider errors, the next one is tried
- [x] Responses are normalised to one shape for every provider (tested with recorded responses)
- [x] Calls are recorded in the AI ledger

**Comments:**
- 2026-10-25: Built `supabase/functions/_shared/decide.ts` and the thin Edge Function `supabase/functions/decide/index.ts`. The app POSTs `{ lang, state, questions }` (questions keyed by snake_case name; types `choice` with `choices`, `score` with 2–10 `levels`, `yes_no`; state is text or a JSON object, max 8,000 characters) and gets `{ provider, model, answers }`. Every answer has one shape: choice `{ value, confidence, probabilities: { value: p } }`, score `{ value, level, confidence, probabilities: [p per level] }`, yes_no `{ value, probability }`.
  - Providers: `jev` (TypeSafe `POST /v1/systemone`, `jev-latest`), `openai` (`POST /v1/decisions`, `gpt-6-luna`), `haiku` (Anthropic `claude-haiku-5-5` asked for probabilities as JSON; its confidence is the top probability). The order is the `DECISION_PROVIDERS` secret, with optional `DECISION_PROVIDERS_EN` / `_ES`; the default `jev,openai,haiku` follows ticket 35's pick of Jev for both languages.
  - Fallback: a provider with no key, an HTTP or network error, an OpenAI refusal, a reply missing an answer, or a reached cap is skipped and the next is tried. All capped → 429 `AI_LIMIT_REACHED`; no keys → 500 `NOT_CONFIGURED`; otherwise 502 `AI_FAILED`.
  - Ledger: each call goes through `withAiCap` (ledger models `typesafe/jev`, `openai/gpt-6-luna`, `anthropic/claude-haiku-5-5`); a reply that returns but fails the check is still recorded. `prices.ts`: Jev now `primary`; gpt-6-luna output set to $0 (Decisions output is free, per OpenAI's guide).
  - Tests: `web/src/lib/decideEdge.test.js` (26) with two real Jev replies from the ticket 35 run, an OpenAI reply shaped from the excerpts in OpenAI's guide (no live OpenAI call has been made), and an Anthropic-shaped text reply. Full suite 1331 passing, lint and format pass. NOT RUN: Deno type check (no Deno here), a deployed call, and a real ledger insert (tested with a fake client only).
  - For 59 and 61, from ticket 35: put the day's Plan and the Member's Calorie Target in `state`, and ask one clarifying choice below 0.6 confidence.
