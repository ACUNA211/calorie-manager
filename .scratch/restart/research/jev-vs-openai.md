# Jev vs OpenAI Decisions vs Cloudflare Clef: test design and vendor check

Ticket 35. Date: 2026-10-17. Spend so far: $0. No API keys were available, so no live run has happened and there are no accuracy, speed or cost results yet.

## What the test is for

ADR 0002 uses a decision model for two jobs: Rebalance (rate how far over a day went, which meal, what fix) and Voice commands (rank the likely actions). The test checks which provider to use for each language (English, Spanish) before ticket 58 builds on it. Jev is the first choice. OpenAI Decisions (gpt-6-luna) and Cloudflare Clef are the fallbacks named in ADR 0002.

## Vendor check (own pages, read 2026-10-17)

**TypeSafe Jev: exists; price confirmed on the vendor page.**
- docs.typesafe.ai/models: Jev 1.14 and 1.13. Price $0.042 per million input tokens. "Output tokens are free." This confirms the figure costs.md labelled unverified.
- Limits stated: no maximum number of questions per call ("the limit is the context size"). Per-request context 64k tokens by default (262k with long context). Per-question context 32k by default (262k with long context).
- Not stated: maximum options per Choice, Score level count, Choice and Score request shapes, any timeout or rate limit.
- Request shape seen: `questions` is an object keyed by question name, each with `type` and `instructions`; the only type shown is `noul` (yes/no). Responses include a `model` field. The runner's Jev adapter follows this shape but treats choice and score as unconfirmed.
- Data: "Jev is not trained on customer requests or responses." Retention is referred to the Legal page; no period given.
- Jev access (waitlist, signups): conflicting secondary reports (costs.md). Not confirmed on vendor pages.
- Jev API endpoint URL: not found on the pages read. The runner needs `JEV_URL` set by hand.

**OpenAI Decisions API: exists as a public beta; price and status confirmed on OpenAI's page.**
- developers.openai.com/api/docs/guides/decisions: `POST https://api.openai.com/v1/decisions`, bearer auth. Only `gpt-6-luna` is supported. Status: "in public beta, and we expect to GA in the coming weeks."
- Request: `{model, input, questions}`. Question types: `choice` (2–255 choices with `value`, optional `description`), `score` (2–10 ordered `levels` with `label`), and `predicate` (yes/no probability). Example request bodies are published on the page.
- Response: an `answers` array with one answer per question, in question order. `choice` returns `choice`, `probabilities`, `confidence`. `score` returns `score` (probability-weighted mean of zero-based level indices), `probabilities`, `confidence`. Images are inline base64 only.
- Price: input $0.10 per million tokens with gpt-6-luna, input-only billing, no output charge (the page's figure). Regional premiums and long-context multipliers apply.
- Stated limits: 128 images per request, 2–255 choices, 2–10 score levels. Not stated: maximum questions per request, rate limits, timeouts, error formats.
- Stated privacy: Zero Data Retention and HIPAA for eligible customers; data residency in the US and EEA plus Switzerland.
- Note: the openai.com page fetch was summarised by a small model, so the exact JSON should be checked by eye on the first live run.
- Not on the OpenAI pricing page (developers.openai.com/api/docs/pricing): no Decisions entry there. gpt-6-luna standard is $0.10 input, $0.50 output on that page. The fetch confirmed these figures.
- Secondary sources (StackOne, Vercel) disagree on whether it is a "public beta" or "limited preview". The OpenAI page says public beta.

**Cloudflare Clef: exists per secondary coverage only; not confirmed on Cloudflare's own pages.**
- Cloudflare's product page URL I tried returned HTTP 404. No Cloudflare page describing Clef was found.
- Secondary sources (pasqualepillitteri.it, themenonlab.blog, developersdigest.tech) say: Clef and Clef-flash are open-weight, Apache 2.0, on Workers AI; described as "fully Jev-API compatible"; image and video input; 64k context; price reported as $0.24 and $0.09 per million input tokens (which figure is which is unclear). One source gives a "Qwen3.8-27B" label and flags it as a possible typo.
- Cloudflare's Workers AI pricing page (developers.cloudflare.com/workers-ai/platform/pricing) bills in Neurons ($0.011 per 1,000, 10,000 free per day). It does not list Clef in the snippet read.
- Verdict: **not confirmed**. Do not rely on the price or the compatibility claim until a Cloudflare page is read.

## Test set

File: `decisions-test/messages.json`. 50 messages.

| Set | Count | Messages (EN / ES) | Kind |
|---|---|---|---|
| Rebalance | 25 | 13 / 12 | "big lunch at a wedding, way over" type |
| Voice command | 25 | 12 / 13 | "tick off the milk" type |

Each message has `id`, `lang`, `kind`, `text`, and `expected`. The questions for each kind are in `question_sets`:

- **Rebalance**: `over_by` (Score, 5 levels, 0 = just a bit over to 4 = way over), `meal` (Choice: breakfast, lunch, dinner, snack, other), `fix` (Choice: lighter_later_today, lighter_tomorrow, drop_if_room_meal, no_preference), `gave_number` (yes/no).
- **Voice command**: `action` (Choice of the six actions in CONTEXT.md: tick a Shopping list line, add to the Shopping list, log a planned Portion, log something else, mark a Pantry item used or partly used, start a Rebalance), `has_amount` (yes/no).

The question wording is in English for both languages, so the only variable across languages is the message text. Expected answers are labelled by hand. Ambiguous messages were avoided.

The sets are not balanced across meal types or fixes on purpose. They are a first pass, not a statistically strong sample: 50 messages give roughly ±14 points at 95% confidence on a single accuracy figure. Expect to add messages from real Household use before the choice is final.

## Runner

File: `decisions-test/run-decisions-test.mjs` (Node 18+, no dependencies).

- `node run-decisions-test.mjs` or `--dry-run`: validates `messages.json` (ids, kinds, expected values in range) and prints the counts. No network, no spend. Run this now: it passes (50 messages: 25 EN, 25 ES, 25 Rebalance, 25 Voice).
- `--provider openai --limit 1`: a one-message smoke test. Use it first to confirm the response envelope, since the runner reads the first `answers` array it finds.
- `--provider openai` / `jev` / `clef`: full run. Each needs its key in the environment: `OPENAI_API_KEY`, `TYPESAFE_API_KEY`, `CLOUDFLARE_API_TOKEN`. Jev and Clef also need `JEV_URL` and `CLEF_URL`, which are not confirmed and must be set by hand. Without the key the script exits with "Pending keys" and spends nothing.
- Output: `decisions-test/results/<provider>-<date>.json` with each message's raw answer, the scored value, confidence and latency. Accuracy is worked out from that file, not typed into the report.

Scoring: `choice` is correct when the highest probability matches the expected value. `score` is correct when the rounded score equals the expected level index. `yes_no` is correct when the probability is above 0.5 and matches. Confidence is saved so that confidence can be compared with correctness.

## What is still needed

1. **API keys (the user must supply):** an OpenAI API key with Decisions access; a TypeSafe Jev key (and the Jev endpoint, `JEV_URL`, from docs.typesafe.ai); optionally a Cloudflare API token and Workers AI endpoint for Clef, once Cloudflare's own page is found. Keys go in environment variables only, never in files.
2. **Live runs (pending keys):** run the smoke test, then the full test per provider. Record accuracy, confidence against correctness, latency and cost from the results files. Cost is roughly input tokens times the price above (Jev $0.042 per million; gpt-6-luna $0.10 per million; Clef unconfirmed).
3. **Clarify:** whether the user wants to spend the test budget (expected under $1 for 50 messages times 3 providers, by my arithmetic: each message is a few hundred tokens).
4. **Vendor confirmations still open:** Jev's Choice and Score request shape, maximum questions and options, endpoint URL; Clef's existence and price on a Cloudflare page; Jev access status.

## Accuracy, speed and cost

Not measured. No numbers are given here. The per-language pick for ticket 58 is not made.
