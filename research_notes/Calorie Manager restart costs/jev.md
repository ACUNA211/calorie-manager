# TypeSafe AI's Jev ("System One" decision model) as a component of a household calorie-tracking app (as of Oct 2026)

> **Method note (read first):** The session's network policy blocked direct page fetches. typesafe.ai, docs.typesafe.ai, thenewstack.io, openrouter.ai and developersdigest.tech all returned connect_rejected / ENOTFOUND. So every finding below comes from **search-engine result summaries** of the cited URLs, not from reading the pages in full. The numbers are consistent across many sources, but treat exact figures as "reported, verify on the page" until someone opens the primary pages, especially docs.typesafe.ai/models, docs.typesafe.ai/api and console.typesafe.ai. Much of the Jev coverage comes from SEO-style third-party blogs, and some domains (jev-agent.com, jevtypesafe.org, jev-ai.live, jevstation.com, omniakey.com) look unofficial. I rate them low-trust.

## What Jev is (context)

### Takeaway
Jev is TypeSafe AI's first model, a closed-weights "System One" decision model launched in mid-September 2026 (early access, roughly Sept 15–16). It does not generate text. You send it a text "state" plus typed questions (Choice / Score / Noul), and it returns probabilities and a confidence for each question, all answered in parallel in one call.

### Cited Findings
- Jev is TypeSafe AI's first model. It returns structured decisions (choices, scores, yes/no) with calibrated confidence instead of text, and targets routing, classification, scoring, extraction and verification — [VKTR](https://www.vktr.com/ai-platforms/chatgpt-cocreator-launches-typesafe-ai-with-jev/); [letsdatascience](https://letsdatascience.com/news/typesafe-ai-launches-jev-decision-model-889a38c0); [The New Stack](https://thenewstack.io/typesafe-jev-system-one/)
- Launched Sept 15, 2026 as early access. "Jev takes the current state of a task or workflow as input and returns a defined decision, along with the probability of that decision" — [letsdatascience](https://letsdatascience.com/news/typesafe-ai-launches-jev-decision-model-889a38c0)
- The company left stealth with a $40M seed led by DCVC ($200M valuation) — [SiliconANGLE](https://siliconangle.com/2026-09-16/typesafe-ai-exits-stealth-with-40m-to-build-ai-for-use-by-software/); [buttondown AI funding report](https://buttondown.com/aaronyi/archive/ai-funding-typesafe-ai-40m-seed-round-for-machine/)
- About three weeks later (reported ~Oct 9, 2026) it raised ~$870M at a $7.5B valuation, led by a16z, with Sequoia and DCVC participating — [Bloomberg Gov](https://news.bgov.com/us-law-week/andreessen-horowitz-backs-jev-maker-at-7-5-billion-value); [Dealroom](https://dealroom.co/news/161206-andreessen-horowitz-leads-870m-round-for-ai-startup-typesafe-at-7-5b-val/). One KuCoin flash item gives garbled figures ($75B / $8.7B) and is likely a typo — [KuCoin](https://www.kucoin.com/news/flash/typesafe-ai-completes-870m-series-a-funding-valued-at-7-5b)
- Training method is "Reinforcement Learning for Calibrated Decisions" (RLCD), which optimizes calibrated probabilities on structured decisions — [innfactory](https://innfactory.ai/en/ai-models/typesafe-jev/); [InfoQ](https://www.infoq.com/news/2026/10/typesafe-ai-jev-released/)
- Vendor claim: Jev "can't hallucinate." Press notes that outputs are still not guaranteed correct and that calibration must be checked on your own data — [VKTR](https://www.vktr.com/ai-platforms/chatgpt-cocreator-launches-typesafe-ai-with-jev/); [letsdatascience](https://letsdatascience.com/news/typesafe-ai-launches-jev-decision-model-889a38c0)
- Versions: Jev 1.13, then Jev 1.14 (listed on OpenRouter with release date Oct 14, 2026). The `jev-latest` alias points to the newest model — [OpenRouter Jev 1.14](https://openrouter.ai/typesafe/jev-1.14); [OpenRouter jev-latest](https://openrouter.ai/~typesafe/jev-latest)

### Inferences
- The company is very well funded as of October 2026, which lowers short-term shutdown risk. But the API is weeks old and still "early access," so expect breaking changes. The SDK and raw JSON shapes already differ (see API section).

### Gaps
- The launch blog post itself was not read directly, because fetches were blocked.

## Pricing, access, rate limits, latency, resellers

### Takeaway
Pricing is consistently reported at **$0.042 per million input tokens, output free**, both direct and on OpenRouter/ZenMux. There are no published plan tiers or minimum spend. Access status is contested: the waitlist was reportedly dropped around Sept 20–21 with a $5 credit, then signups were reportedly paused on Sept 22. Rate-limit and context figures conflict between sources. OpenRouter and ZenMux carry Jev, and Runware shows it only as "Coming Soon."

### Cited Findings
**Pricing**
- $0.042 per 1M input tokens, output tokens free. The launch post is the original source — [eesel.ai pricing (EN)](https://www.eesel.ai/blog/typesafe-jev-pricing); [eesel.ai (ES)](https://www.eesel.ai/es/blog/typesafe-jev-precios)
- "No published plan-tier table, no self-serve free tier, no printed rate limit" (as of that article's writing) — [eesel.ai (ES)](https://www.eesel.ai/es/blog/typesafe-jev-precios)
- OpenRouter and ZenMux list the same $0.042/M input with no output charge. One comparison table shows Jev 1.13 at $0.042 in / $0 out against GPT-5 mini at $0.25 / $2.00 — [betonai.net](https://betonai.net/?p=1920); [OpenRouter Jev 1.13](https://openrouter.ai/typesafe/jev-1.13); [ZenMux jev-1.13](https://zenmux.ai/typesafe/jev-1.13)
- A pricing site advises confirming account eligibility and invoice terms before planning production traffic — [aipricing.guru](https://www.aipricing.guru/typesafe-pricing/)
- TypeSafe itself reportedly said "We can't prove it isn't subsidized" about its cost claims. Treat this as an unverified quote; it surfaced via search summary only — [eesel.ai](https://www.eesel.ai/blog/typesafe-jev-pricing)
- No source mentions a minimum spend — (absence across [eesel.ai](https://www.eesel.ai/blog/typesafe-jev-pricing), [layer3labs pricing](https://www.layer3labs.io/guides/jev-pricing))

**Free tier / credits / waitlist (conflicting)**
- At launch, access was by waitlist at typesafe.ai — [letsdatascience](https://letsdatascience.com/news/typesafe-ai-launches-jev-decision-model-889a38c0); [ecosistemastartup](https://ecosistemastartup.com/typesafe-ai-levanta-us40m-con-jev-modelo-de-decisiones/)
- Reports say the waitlist ended around Sept 20–21, 2026, with open signup at console.typesafe.ai and a $5 free credit (~120M input tokens) — [explainx.ai](https://www.explainx.ai/blog/jev-general-availability-no-waitlist-2026); [vandatateam](https://vandatateam.com/blog/jev-api-getting-started)
- Contradiction: one walkthrough says a Sept 22, 2026 console signup "showed no credit balance anywhere" — [layer3labs pricing](https://www.layer3labs.io/guides/jev-pricing)
- Contradiction: one source says TypeSafe **paused new signups on Sept 22** citing demand, while existing accounts keep working. Whether signups have reopened is unknown — [layer3labs / aiprofitboardroom](https://aiprofitboardroom.com/blog/how-to-get-access-to-jev/)
- Other access routes: Vercel AI Gateway (no waitlist, though its free promo reportedly ended Sept 25, 2026) and Cloudflare. Databricks also documents a System One endpoint — [firecrawl](https://www.firecrawl.dev/blog/what-is-jev); [Databricks docs](https://docs.databricks.com/gcp/en/machine-learning/model-serving/query-systemone-models); [lmspedia](https://lmspedia.org/jev-pricing-access-guide/)

**Rate limits (conflicting, all per-org)**
- Figures reported: 100k tokens/s and 40 req/s; 100k tokens/s and 80 req/s; 250k tokens/s and 1,200 req/min. All say limits are per organization, can change, and return HTTP 429. Official docs point to the developer console — [docs.typesafe.ai/models](https://docs.typesafe.ai/models); [innfactory](https://innfactory.ai/en/ai-models/typesafe-jev/); [firecrawl](https://www.firecrawl.dev/blog/what-is-jev)

**Latency**
- Vendor figure: 70–500 ms end-to-end. One independent analysis of launch-day posts found a median of ~76 ms and an upper quartile of ~270 ms — [innfactory](https://innfactory.ai/en/ai-models/typesafe-jev/); [letsdatascience](https://letsdatascience.com/news/typesafe-ai-launches-jev-decision-model-889a38c0)

**Resellers**
- **OpenRouter:** Jev 1.13 and 1.14 are listed. It uses OpenRouter's separate Decisions API (`/api/alpha/decisions`), not chat completions, so standard chat SDKs won't work. No EU in-region routing — [OpenRouter Jev 1.14](https://openrouter.ai/typesafe/jev-1.14); [OpenRouter Jev tutorial](https://openrouter.ai/docs/guides/community/jev-tutorial); [OpenRouter "What is Jev"](https://openrouter.ai/blog/insights/what-is-jev/)
- **ZenMux:** "TypeSafe: Jev 1.14 is now live on ZenMux," with TypeSafe as its only provider (no multi-provider redundancy) — [ZenMux on X](https://x.com/ZenMuxAI/status/2110571383847780828); [ZenMux models](https://zenmux.ai/models); [ZenMux routing guide](https://zenmux.ai/blog/how-to-use-jev-for-llm-routing-with-zenmux-a-developer-guide)
- **Runware:** the TypeSafe AI creator page shows Jev as "Coming Soon" — [Runware](https://runware.ai/creators/typesafe-ai)
- One gateway reportedly has Jev in nearly 13% of its paid teams. The vendor-sourced claim that "a third of Fortune 500" use Jev is unverified and no names were given — [runtimewire](https://runtimewire.com/article/typesafe-investors-discuss-a-higher-valuation-after-jev-reaches-nearly-13-of-one); [letsdatascience blog](https://letsdatascience.com/blog/openai-jev-rival-three-weeks-typesafe-raised-870-million)

### Inferences
- For a hobby or household app, the cleanest path is probably OpenRouter or ZenMux: same price, no TypeSafe waitlist or signup-pause risk, and one key for Jev plus fallback LLMs. OpenRouter needs its own Decisions endpoint, so plan a thin client.
- Rate limits are irrelevant at household scale (a few hundred calls per week).

### Gaps
- Not confirmed from primary pages: whether TypeSafe direct signups are open as of Oct 17, 2026, and whether the $5 credit exists.
- No source documents a minimum charge or a per-request minimum billable tokens. Unverified.
- No source documents how many tokens a question definition consumes (it is billed as input, but the exact accounting is unverified).

## API shape: questions, inputs, outputs, context, SDKs

### Takeaway
Each request is a POST of a text **state** plus up to many typed **questions**. **Choice** picks one of up to 255 options, **Score** rates the state on 2–10 ordered levels and returns an expected score, and **Noul** returns P(yes) for a condition. Each answer comes back with per-option probabilities and a confidence. Input is text only (JSON can be serialized into the state). Jev does not produce free numeric values and does no arithmetic. Context is reported at 64k per request (32k for state plus the longest question), with a documented 262k long-context header mode.

### Cited Findings
- Endpoint: `POST https://api.typesafe.ai/v1/systemone`, bearer token, `"model": "jev-latest"`. A score request uses a `criteria` list of ordered labels — [TypeSafe API reference](https://docs.typesafe.ai/api); [TypeSafe quickstart](https://docs.typesafe.ai/introduction/quickstart)
- Raw response nests results under `answers`. A Choice returns the chosen label, per-option probabilities and confidence. A Score returns a numeric score, a legend mapping levels to labels, and per-level probabilities, plus a `usage` block with token counts — [TypeSafe API reference](https://docs.typesafe.ai/api); [unofficial GitHub guide](https://github.com/typesafe-docs/typesafeai)
- Python and TypeScript SDKs exist and read results via `response.choices[...]` / `response.scores[...]`, which differs from the raw `answers` JSON. A DataCamp example uses `options` plus min/max for score, which does not match the official schema — [TypeSafe Python SDK basic usage](https://docs.typesafe.ai/sdk/python/usage/basic); [DataCamp blog](https://www.datacamp.com/blog/system-one-models-jev); [DataCamp tutorial](https://www.datacamp.com/tutorial/jev-api-tutorial)
- Primitives: Choice "selects one option from a defined set and returns every option's probability plus confidence." Score "rates state against ordered descriptive levels and returns an expected score, level probabilities and confidence." Noul "evaluates one yes/no condition and returns the probability of yes" — [befailproof.ai](https://befailproof.ai/jev/primitives/); [flaviocopes](https://flaviocopes.com/jev/); [opentweet](https://opentweet.io/jev/choice-score-noul)
- Limits: Choice up to 255 options; Score 2–10 levels; all questions answered in parallel in one call — [layer3labs limits](https://www.layer3labs.io/guides/jev-limits); [firecrawl](https://www.firecrawl.dev/blog/what-is-jev)
- Context (conflicting): 64k tokens per request (state plus all questions), with 32k for state plus the longest single question. Official docs describe a 262k long-context mode enabled by a request header. InfoQ says 32k total, and one arXiv paper says the context window is unpublished — [docs.typesafe.ai/models](https://docs.typesafe.ai/models); [InfoQ](https://www.infoq.com/news/2026/10/typesafe-ai-jev-released/); [arXiv 2609.28940](https://arxiv.org/pdf/2609.28940); [betonai (32K)](https://betonai.net/?p=1920)
- Input is text only: no images, no native PDF layouts — [firecrawl](https://www.firecrawl.dev/blog/what-is-jev); [mohammadsoleimanian](https://mohammadsoleimanian.com/jev-for-10-k-data-extraction-fast-calibrated/)
- "Not a calculator. Counting, date arithmetic and numeric interpolation belong in your code, not in a question." Extract components as closed options with an explicit "not stated" option — [layer3labs limits](https://www.layer3labs.io/guides/jev-limits); [reactify handbook](https://www.reactify-solutions.com/handbooks/jev/limits)
- Accuracy drops as unrelated content grows (filter input first). Questions are read literally, so write exact conditions into the instructions — [reactify handbook](https://www.reactify-solutions.com/handbooks/jev/limits); [smartscope "jaggedness"](https://smartscope.blog/en/blog/jev-jaggedness-safety-patterns-2026/)

### Inferences
- **Mapping to Rebalance:** The state is the user's message plus a compact serialized day log (target, eaten so far, remaining meals). Questions could be:
  - Choice `meal_type` {breakfast, lunch, dinner, snack, drinks, event/celebration}
  - Score `how_far_over` (e.g. 5 levels: "barely", "~1 snack", "~1 small meal", "~1 full meal", "more than a full meal")
  - Choice `rebalance_preference` {spread over rest of week, trim remaining meals today, skip a snack, add activity, ignore/accept}
  - Noul `user_gave_explicit_number`

  Jev **cannot extract "I ate 1,800 kcal" as a free number**. Either parse digits in code or a cheap LLM, or bucket them. The fixed formulas in code take the bucket midpoint or expected score.
- The "confidence" output fits a "ask a clarifying question if confidence < threshold" UX naturally, but the threshold must be tuned locally (see calibration evidence).
- **Mapping to meal planning:** A Score question per recipe, e.g. "fit to household preferences" on 5 levels, plus a Noul "violates a dislike/allergy," batched as many questions in one call. 255 options per Choice also allows "pick the best recipe of N" in a single call.

### Gaps
- Not confirmed: the maximum number of questions per request.
- Not confirmed: whether question text counts toward billing exactly like state tokens.
- Not confirmed: exact SDK package names and versions.

## Limits, languages, privacy and data use

### Takeaway
Jev has no text generation, is closed weights, has no self-hosting and no EU region. It is English-first, with other languages "supported with variable accuracy." Reported data terms are no training on customer requests and zero data retention for enterprise on request, but these come from secondary sources, not a policy page I could read.

### Cited Findings
- No text generation; closed weights; no self-hosting; no EU region; knowledge cutoff undocumented; early access — [innfactory](https://innfactory.ai/en/ai-models/typesafe-jev/); [InfoQ](https://www.infoq.com/news/2026/10/typesafe-ai-jev-released/); [OpenRouter (no EU in-region routing)](https://openrouter.ai/typesafe/jev-1.14)
- Built for English. Other languages, including CJK, are reportedly supported with variable accuracy — [docs.typesafe.ai/models](https://docs.typesafe.ai/models); [sanity glossary](https://www.sanity.io/glossary/jev-typesafe-ai-model)
- No training on customer requests; zero data retention available to enterprise customers on request. Vercel AI Gateway offers per-request ZDR and no-training options — [firecrawl](https://www.firecrawl.dev/blog/what-is-jev); [neuraltrust security guide](https://neuraltrust.ai/blog/jev-typesafe-ai-security)

### Inferences
- A household app sends meal descriptions plus calorie data. This is personal (health-adjacent) data but low sensitivity. Default non-enterprise retention terms are unknown, so if that matters, routing via Vercel with ZDR is the documented option.
- Generating any user-facing text ("Here's your plan…") still needs templates in code or an LLM.

### Gaps
- TypeSafe's actual privacy policy, terms and default retention period for non-enterprise accounts were not read. Unverified.

## Independent evaluations: accuracy and calibration

### Takeaway
Independent results are mixed. Jev roughly matches cheap or mid-price LLMs on simple classification (spam, routing, tool-call risk) and trails frontier models on harder reasoning (LegalBench, medical diagnosis). Calibration is good when pooled but inconsistent per task. The recurring advice is to validate the confidence threshold on your own labeled data.

### Cited Findings
- **Vals AI (LegalBench):** Jev was last of 12 systems on raw and class-balanced accuracy (statistically significant). On claim verification, all 12 were within 17 of 400 items and Jev tied several frontier models — [Vals AI](https://www.vals.ai/blogs/independent-evaluation-of-jev)
- **Medicine (arXiv preliminary):** about equal to GPT-6 Sol (medium reasoning) on PubMedQA, lower on MetaMedQA, much lower on DiagnosisArena-MCQ and NEJM cases. Best-calibrated on MetaMedQA but poor discrimination on DiagnosisArena — [arXiv 2609.34024](https://arxiv.org/abs/2609.34024)
- **Spam / Banking77 (independent blog):** accuracy within noise of an LLM on spam, but calibration was worse. ECE was 0.053 for Jev against 0.006 for the frontier model, "and even the cheap LLM beat Jev" — [Medium, pravvich](https://medium.com/@pravvich/typesafes-jev-beyond-the-hype-an-independent-benchmark-8bdc1c99d000)
- **"Just Ask Jev" (arXiv):** calibrated when pooled across benchmarks but not within individual ones. Median per-benchmark ECE was 0.168 against 0.074 under perfect calibration, and 24 of 31 benchmarks exceeded the null's 95th percentile — [arXiv 2609.29429](https://arxiv.org/pdf/2609.29429)
- **Eight-day independent test:** "level with mid-price LLMs, behind the frontier" — [DEV, aws-builders](https://dev.to/aws-builders/jev-after-eight-days-of-independent-tests-level-with-mid-price-llms-behind-the-frontier-1c60)
- **Agent tool-call risk:** 91.7% on a 60-case set, with every wrong answer at confidence < 1.000. This is a small, single-task sample — [DEV, webofmike](https://dev.to/webofmike/i-benchmarked-jev-on-agent-tool-call-risk-calibration-held-49i3)
- **Amplitude analysis:** "Faster and cheaper, but watch the accuracy" — [Amplitude](https://amplitude.com/blog/jev-analysis)
- **OpenRouter (reseller, not independent):** Jev alone got within 3.3 points of Claude Opus on classification — [OpenRouter blog](https://openrouter.ai/blog/insights/jev-vs-claude-opus-5-classification/)
- **Rubric-judge replay (arXiv):** "Cheaper, faster, and wrong in the same places." Jev-to-LLM cascades cost 16–48% of the best single judge but lose 0.2–1.8 points of held-out accuracy, gaining at most 1.5 points. A cascade helps only when the fallback is right where Jev is wrong — [arXiv 2609.29769](https://arxiv.org/html/2609.29769v1)
- A Sept 22, 2026 review said no independent benchmark existed yet (now outdated) — [layer3labs review](https://www.layer3labs.io/guides/jev-review)

### Inferences
- Rebalance classification (meal type, rough magnitude, stated preference) is a simple, English, everyday-language task, close to the spam/routing regime where Jev does about as well as a cheap LLM. "How far over" is the weakest part, because it implies portion and calorie estimation. Cheap LLMs are likely no better, but should be checked on a small labeled set (e.g. 50 real household messages).
- Don't trust the raw confidence as a probability without a local check. Per-task ECE can be several times worse than ideal.

### Gaps
- No evaluation found on food, nutrition or portion-estimation text.
- No evaluation found on non-English household use.

## Estimated costs: Rebalance and weekly-plan scoring

### Takeaway
At $0.042/M input, Jev costs about **$0.00004–$0.00013 per Rebalance call**. A household of 2–4 people plus weekly planning comes to **roughly $0.01–$0.10 per month**, effectively free. A cheap LLM with structured output doing the same work costs about **$0.05–$0.75 per month**. Both are negligible, so the decision rests on latency, calibration and API maturity, not cost.

### Cited Findings (price inputs)
- Jev: $0.042/M input, $0 output — [eesel.ai](https://www.eesel.ai/blog/typesafe-jev-pricing); [OpenRouter](https://openrouter.ai/typesafe/jev-1.14)
- GPT-5 nano ~$0.05 in / $0.40 out per M (one older source lists output at $0.20). GPT-5.4 nano $0.20 / $1.25 — [promptunit Oct 2026](https://www.promptunit.ai/ai-api-pricing); [intuitionlabs](https://intuitionlabs.ai/articles/llm-api-pricing-comparison-2025)
- Claude Haiku 5.5 ~$0.10 in / $0.50 out per M (≤100K-token prompts). This is a third-party aggregator figure; verify on Anthropic's pricing page — [promptunit Oct 2026](https://www.promptunit.ai/ai-api-pricing); [gitautoreview](https://gitautoreview.com/tools/llm-pricing)
- Gemini 3.5 Flash-Lite ~$0.30 in / $2.50 out per M. Gemini 2.5 Flash-Lite ($0.10 / $0.40) was reportedly retired Oct 16, 2026. Thinking tokens can add unbudgeted output cost — [benchlm Gemini pricing Oct 2026](https://benchlm.ai/google/api-pricing); [cloudzero](https://www.cloudzero.com/blog/gemini-pricing/)

### Inferences (my arithmetic, assumptions stated)
**Assumptions**
- **Rebalance call:** ~1,500 input tokens. This covers the user message, a serialized day log, and the question definitions (4 questions). A range of 1,000–3,000 is plausible.
- **LLM version:** the same 1,500 input plus ~100 output tokens of JSON.
- **Household volume:** 2–4 people × 1–2 rebalances/day × 30 days = **60–240 calls/month**.
- **Planning:** ~300 scoring calls per weekly plan × ~4.3 weeks = **~1,300 calls/month**, each ~1,000 input tokens (recipe summary plus preferences). An LLM version adds ~50 output tokens each.

**Per Rebalance call**

| Model | Cost per call |
|---|---|
| Jev | 1,500 × $0.042/M = **$0.000063** (3k tokens = $0.000126) |
| GPT-5 nano | $0.000075 + $0.00004 = **$0.000115** |
| Claude Haiku 5.5 | $0.00015 + $0.00005 = **$0.0002** |
| Gemini 3.5 Flash-Lite | $0.00045 + $0.00025 = **$0.0007** (more if it "thinks") |

**Per month: Rebalance (max 240 calls)**

| Model | Cost per month |
|---|---|
| Jev | **$0.015** |
| GPT-5 nano | **$0.028** |
| Haiku 5.5 | **$0.048** |
| Flash-Lite 3.5 | **$0.17** |

**Per month: Planning (~1,300 calls)**

| Model | Cost per month |
|---|---|
| Jev | 1.3M tokens = **$0.055** |
| GPT-5 nano | **~$0.09** |
| Haiku 5.5 | **~$0.16** |
| Flash-Lite 3.5 | **~$0.55** |

**Monthly total (worst case, 4 people)**

| Model | Total |
|---|---|
| Jev | **~$0.07** |
| GPT-5 nano | **~$0.12** |
| Haiku 5.5 | **~$0.21** |
| Flash-Lite 3.5 | **~$0.72** |

- If Jev has a $5 credit, it would cover these volumes for years. That credit is contested and unverified.
- **Routing savings for planning:** The bigger lever is avoiding the expensive LLM. If a full plan-drafting call to a mid or frontier LLM costs, say, $0.02–$0.10, then cutting it from "every regeneration" to "only when Jev's fit-score confidence is low" saves more than all Jev costs combined. Independent replay shows cascades reliably cut cost (to 16–48%) but don't improve accuracy — [arXiv 2609.29769](https://arxiv.org/html/2609.29769v1). An OpenRouter cookbook uses a 0.8–0.9 accept threshold — [OpenRouter cascade cookbook](https://openrouter.ai/docs/cookbook/evaluate-and-optimize/jev-verified-cascade). A 50-item test kept 56% of LLM calls eliminated at a 0.95 threshold — [DEV](https://dev.to/jayeshtankariya/your-agent-harness-is-paying-llm-prices-for-classifier-decisions-4dde)

### Gaps
- Real token counts per question definition and per serialized day log were not measured. Running the `usage` block on a sample call would settle this.
- The cost of the "expensive LLM" planning call depends on which model the app uses. That is not in scope here.

## Jev vs. a cheap LLM with structured output: trade-offs

### Takeaway
At household scale the cost gap is cents per month, so choose on other grounds. Jev wins on latency (~76–270 ms), explicit per-option probabilities, and zero output cost. A cheap LLM wins on maturity, multilingual robustness, free-number extraction, and generating the explanatory text in the same call. Its calibration is not worse in at least one independent test.

### Cited Findings
- Jev latency is a median of ~76 ms (launch-day posts) and 70–500 ms per the vendor — [innfactory](https://innfactory.ai/en/ai-models/typesafe-jev/)
- A cheap LLM matched or beat Jev's calibration on a spam task (ECE) — [Medium, pravvich](https://medium.com/@pravvich/typesafes-jev-beyond-the-hype-an-independent-benchmark-8bdc1c99d000)
- Jev is "level with mid-price LLMs" overall — [DEV, aws-builders](https://dev.to/aws-builders/jev-after-eight-days-of-independent-tests-level-with-mid-price-llms-behind-the-frontier-1c60)
- Jev needs a non-chat API on OpenRouter (its Decisions endpoint), and the SDK and raw schemas differ, which means extra integration work — [OpenRouter tutorial](https://openrouter.ai/docs/guides/community/jev-tutorial); [TypeSafe API reference](https://docs.typesafe.ai/api)
- ZenMux has a single provider for Jev (no redundancy) — [ZenMux guide](https://zenmux.ai/blog/how-to-use-jev-for-llm-routing-with-zenmux-a-developer-guide)
- Gemini Flash-Lite "thinking tokens nobody budgeted for" can inflate LLM cost — [cloudzero](https://www.cloudzero.com/blog/gemini-pricing/)

### Inferences
- **Rebalance fit:** Good. The task is exactly "closed-set classification + bucketed score + confidence → code formula." Caveats:
  1. Numbers the user states ("~1,500 kcal") need code or LLM parsing.
  2. Tune the clarify-threshold on ~50 labeled household messages.
  3. Keep a cheap-LLM fallback behind the same interface in case Jev access or signup or schema changes.
- **Meal-planning fit:** Reasonable as a cheap batch scorer or ranker and as a gate deciding when to call the expensive LLM. It is not a replacement for plan generation. Hard constraints (allergies, calorie totals) belong in code, not in Jev.
- **Pragmatic recommendation for the report writer:** Either choice costs under $1 per month. Jev is attractive for snappy UX and explicit probabilities. A Haiku or nano tier is the safer, single-integration default. A pluggable "decision" interface makes swapping trivial.

### Gaps
- No head-to-head test exists of Jev against a nano or Haiku tier on food-log text.
- Primary-page verification (pricing page, docs, terms) is outstanding because fetches were blocked in this session.
