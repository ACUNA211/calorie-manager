# Meal Plan model test (ticket 36)

Status: **kit built, live runs pending API keys.** No model has been called, so there are no scores, no measured token counts and no spend yet. Token and cost figures below are estimates from the prompt size, labelled as such.

## What it tests

Whether a cheap model can draft one week of Meal Plan when code does the filtering and the arithmetic. The model only chooses a Recipe id and a portion for each slot. Code checks every answer, so a model can break a rule only by picking a bad Recipe or a bad portion.

Three models are compared on the same four weeks:

| Model | Why | Price (USD per million in / out) | Price source |
|---|---|---|---|
| `claude-haiku-5-5` | The recommended model in costs.md and ADR 0002 | $0.10 / $0.50 | primary, read in full |
| `gemini-3.1-flash-lite` | Cheapest primary-verified Google model in costs.md | $0.25 / $1.50 | primary, read in full |
| `gpt-6-luna` | Same price as Haiku from a different vendor; the only other $0.10 / $0.50 model in costs.md | $0.10 / $0.50 | secondary (LiteLLM price file) |

`gpt-oss-20b` on Together was left out: it has the lowest price, but its only price source is secondary and it is an open-weight model served by a third party. `gpt-5.4-nano` was left out as the next option if `gpt-6-luna` cannot be reached. Both model ids for Gemini and gpt-6-luna are marked **verify** in `runner.mjs`: check them on the vendor's model page before the first live run.

## Inputs (`inputs/`)

- `meal-times.json`: the seven Meal Times from the Household's real planner (`chat-plan/meal-planner-instructions.md`): Breakfast, Lunch (Mon, Wed, Thu, Fri), Work lunch (Tue, Set, 900 kcal), Weekend lunch (Sat, Sun), Snack, Dinner, Dessert (Fri, Sat).
- `targets.json`: Calorie Target 2,000 kcal as a ceiling; Planning band 90–100%, so 1,800–2,000. One Member only (`member-1`), because the source files hold only one person's data.
- `hard-rules.json`: **empty.** No Hard rules are recorded in the source files. The scorer and pre-filter support them through `forbiddenTags`, which are matched to Recipe tags.
- `recipes.json`: 16 candidate Recipes with ids (R01–R16), calories per serving and the Meal Times each suits. Calories come from the chat-plan CSVs (the Oct 4 and Oct 11 weeks), where Sergio estimated them. They are not yet USDA-checked. Tags are placeholders for Hard rules.
- `weeks.json`: four Sunday-start weeks: 2026-10-18, 2026-10-25, 2026-11-01 and 2026-11-08. The two recorded weeks (Oct 4 and Oct 11) were used only to take the Meal Times and Recipe calories. Their one-off Set rows (Indian takeout, Sunday breakfast) are not in the test.

Each week has 29 slots (Planned and If room meal times on their days). The Tuesday work lunch is a fixed 900 kcal and is never a slot.

## Pre-filter (`lib/prefilter.mjs`)

Per slot, a Recipe is a candidate when:
1. it suits the slot's Meal Time,
2. none of its tags is forbidden for anyone eating (Hard rules), and
3. some portion in quarter steps (0.25 to 4 servings) puts its calories inside the slot's range.

The model sees only these candidates, so an unknown id or a Hard-rule Recipe is never offered. Print the candidates for a week with `node lib/prefilter.mjs 2026-10-18`.

## Prompt and output (`prompt.txt`, `output-schema.json`)

The prompt (`lib/prompt.mjs` fills it) gives the rules, the Set meal, and one line per slot: id, date and time, kind and range, and the candidates with kcal per serving. About 8,400 characters for each week.

The model must answer with one JSON object:

```json
{"weekStart":"2026-10-18","plan":[{"slot":"Sun-breakfast","recipeId":"R02","portion":1}, ...]}
```

`recipeId` is `null` (and `portion` 0) only for an empty If room slot. Portions are quarter steps. The schema is in `output-schema.json`.

## Scorer (`scorer.mjs`, no model calls)

`node scorer.mjs <draft.json> [--hard-rules <file>]` counts rule breaks by kind:

- Slot level: `missing_slot`, `unfilled_planned`, `unknown_recipe`, `not_candidate`, `invalid_portion`, `duplicate_slot`, `extra_slot`, `touched_set` (an entry for a Set meal), `range` (portion × kcal outside the slot range), `hard_rule`.
- Day level: `over_target` (day total above 2,000) and `under_band` (day total below 1,800). Set meals count toward the total.

It also reports `bandDistanceKcal`: the sum over the week of kcal outside 1,800–2,000 for each day (under the band, or over the ceiling), and `daysInBand`.

The "would the Household eat it" score is a human rating and is not in the scorer. It is pending.

## Runner (`runner.mjs`)

- `node runner.mjs --dry-run`: no keys, no calls. Prints prompt size and an estimated cost for each model and week.
- `node runner.mjs --model claude-haiku-5-5` (or `--all`, optionally `--week 2026-10-18`): live calls. Keys come only from `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` and `OPENAI_API_KEY`. A model with no key is printed as PENDING and writes nothing.
- Each live call writes `results/<model>/<week>.json` with the raw text, the API's own token counts (thinking tokens are billed as output for Gemini), the cost from the price table, and the scorer result. `results/summary.csv` is regenerated after each run.

Node 18 or later, no installs. Nothing is written to the main checkout.

## Verified so far

The scorer was checked on two hand-written drafts for week 2026-10-18 (`samples/`).

| Draft | Rule breaks | Slot breaks | Day breaks | Band distance (kcal) | Days in band | Breaks by kind |
|---|---|---|---|---|---|---|
| `draft-valid.json` | **0** | 0 | 0 | **0** | **7 of 7** | none |
| `draft-broken.json` | **15** | 9 | 6 | **2,303** | **1 of 7** | missing_slot 1, unfilled_planned 1, unknown_recipe 1, not_candidate 1, invalid_portion 1, extra_slot 1, touched_set 1, range 2, under_band 4, over_target 2 |

Daily totals for the valid draft: Sun 1,820, Mon 1,900, Tue 1,960 (with the 900 work lunch), Wed 1,900, Thu 1,915, Fri 1,885, Sat 1,880.

The broken draft plants one break of each kind. Its daily totals: Sun 1,400, Mon 2,063, Tue 1,960, Wed 1,220, Thu 2,215, Fri 1,185, Sat 1,370.

A third check uses a **synthetic** Hard rule (`samples/test-hard-rules.json`, forbidding the tag `beef` for member-1; not a real Household rule). The valid draft then gets 4 breaks: `not_candidate` 2 and `hard_rule` 2, both on Sun-dinner and Sat-dinner (R08 Beef and bean chili). So the Hard-rule path works. Each affected slot counts two breaks because it is both not a candidate and a Hard-rule breach.

## Estimated cost per plan (not measured)

The dry run estimates input as prompt characters / 4, multiplied by 1.3 for Claude's tokenizer (costs.md). Output is assumed at 1,000 tokens (29 entries of about 25 tokens each), with no thinking tokens. Estimates are the same for all four weeks, because the prompt is the same size each week.

| Model | Est. input tokens | Est. output tokens | Est. cost per draft | Est. cost per plan with 2 revisions (3 calls) | Est. per month (4.34 plans) |
|---|---|---|---|---|---|
| claude-haiku-5-5 | ~2,740 | 1,000 | $0.00077 | $0.0023 | $0.0034 |
| gemini-3.1-flash-lite | ~2,110 | 1,000 | $0.0020 | $0.0061 | $0.0088 |
| gpt-6-luna | ~2,110 | 1,000 | $0.00071 | $0.0021 | $0.0031 |

These estimates are far smaller than costs.md's lean (about 6K in, 2K out) and typical (12K in, 3K out) figures, because the test prompt holds 16 Recipes, not a full library. The estimates say nothing about real token counts, thinking tokens or how often the model needs a revision. The live run replaces them.

## What is pending

1. **API keys** (`ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `OPENAI_API_KEY`). The user supplies these. No keys were used, no accounts were created and no money was spent.
2. **Model ids** for `gemini-3.1-flash-lite` and `gpt-6-luna`: check on the vendor pages before running.
3. **Live scores, measured token counts and actual spend** for each model and week. Run `node runner.mjs --all`.
4. **Household rating** ("would they eat it") for each draft, by a human.
5. **Real Hard rules** in `inputs/hard-rules.json`, and the second and later Members' Meal Times and Targets, for a 2–4 Member test.
6. **USDA-checked calories** for the 16 Recipes, if the test is to measure accuracy rather than rule-following.
7. **The model pick for ticket 42** follows from the live scores. Ticket 42 gets the prompt and JSON shape from this folder.

## Run it

```
cd .scratch/restart/research/meal-plan-test
node scorer.mjs samples/draft-valid.json          # check the scorer, no keys needed
node lib/prefilter.mjs 2026-10-18                 # candidate Recipes per slot
node runner.mjs --dry-run                         # estimated tokens and cost
ANTHROPIC_API_KEY=... node runner.mjs --model claude-haiku-5-5
GOOGLE_API_KEY=...    node runner.mjs --model gemini-3.1-flash-lite
OPENAI_API_KEY=...    node runner.mjs --model gpt-6-luna
```

Set the key in the shell for that run only, and do not commit it.
