# Cheap LLMs for drafting weekly household Meal Plans: prices and cost per plan (October 2026)

Checked 2026-10-17. All prices are USD per 1M tokens. Builds on `.scratch/mvp/research/running-cost.md` (2026-09-30).

**How the sources were checked.** This session's network proxy blocked ai.google.dev, developers.openai.com, api-docs.deepseek.com, openrouter.ai, groq.com, cerebras.ai, together.ai and developers.cloudflare.com. Only three primary or near-primary sources could be read directly:
1. **Anthropic's pricing page**, fetched in full: https://platform.claude.com/docs/en/about-claude/pricing
2. **Google Cloud's Gemini pricing page**, fetched in full. It now redirects to https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing, the old Vertex AI URL. These are Google's official per-token prices for Gemini, which match the Gemini Developer API prices wherever the 2026-09-30 note had both.
3. **LiteLLM's maintained price file**, a secondary source in which each entry cites the provider page it came from: https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json

Everything else comes from web-search aggregators and is marked **unverified**.

## Q1. Current per-million-token prices, reasoning billing and batch discounts

### Takeaway
The cheapest viable tiers now cost about $0.10–0.30 for input and $0.40–2.50 for output. Claude Haiku 5.5 ($0.10/$0.50) and OpenAI's gpt-6-luna ($0.10/$0.50, unverified) cost about the same as gpt-oss on Groq or Vertex. They are roughly 7–9x cheaper than gpt-5.4-mini or Gemini 3.8 Flash. Batch is 50% off on Anthropic and Google, and about 50% on OpenAI (secondary source).

### Price table

| Model | Input | Cached input | Cache write | Output (incl. reasoning) | Batch in / out | JSON schema / tools | Source |
|---|---|---|---|---|---|---|---|
| **Claude Haiku 5.5** (prompts ≤100K) | $0.10 | $0.01 | $0.125 (5 min), $0.20 (1 h) | $0.50 | $0.05 / $0.25 | yes / yes (LiteLLM flags) | [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Haiku 5.5 (prompts >100K) | $0.50 | $0.05 | $0.625 / $1 | $2.50 | $0.25 / $1.25 | " | [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Haiku 4.5 (previous) | $1 | $0.10 | $1.25 / $2 | $5 | $0.50 / $2.50 | yes | [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| **Claude Sonnet 5.5** (for comparison) | $2 | **$0.10** (0.05x, changed from $0.20 in the 09-30 note) | $2.50 / $4 | $10 | $1 / $5 | yes | [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| **Gemini 3.8 Flash**, to 2026-12-31 | $0.75 | $0.075 | none (implicit) | $3.75 | $0.375 / $1.875 (LiteLLM) | yes / yes | [Google Cloud pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing); batch: [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) |
| Gemini 3.8 Flash, from 2027-01-01 | $1.50 | $0.15 | – | $7.50 | ~$0.75 / $3.75 (50%, inferred) | yes | [Google Cloud pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing) |
| **Gemini 3.5 Flash-Lite** (newest Flash-Lite; LiteLLM maps `gemini-flash-lite-latest` to these prices) | $0.30 | $0.03 | – | $2.50 | $0.15 / $1.25 (LiteLLM) | yes / yes | [Google Cloud pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing) |
| **Gemini 3.1 Flash-Lite** | $0.25 | $0.025 | – | $1.50 | $0.125 / $0.75 (LiteLLM) | yes / yes | [Google Cloud pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing) |
| Gemini 2.5 Flash-Lite | $0.10 | $0.01 | – | $0.40 | $0.05 / $0.20 | yes / yes | [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json). One aggregator says it retires 2026-10-16 (**unverified**; see [Search summary](https://www.cloudzero.com/blog/gemini-pricing/)) |
| gpt-5.4-mini | $0.75 | $0.075 | – | $4.50 | $0.375 / $2.25 | yes / yes | [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) (cites developers.openai.com/api/docs/pricing); matches 09-30 note |
| gpt-5.4-nano | $0.20 | $0.02 | – | $1.25 | $0.10 / $0.625 | yes / yes | [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json); same figure at [lmmarketcap](https://lmmarketcap.com/openai-api-pricing) |
| gpt-5.6-luna | $0.20 | $0.02 | – | $1.20 | $0.10 / $0.60 | yes / yes | [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) (**unverified** on OpenAI's page) |
| **gpt-6-luna** (OpenAI's newest small tier) | $0.10 | $0.01 | $0.125 (one aggregator) | $0.50 | $0.05 / $0.25 | yes / yes | [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json); [eesel](https://www.eesel.ai/blog/gpt-6-luna-pricing); [AnotherWrapper](https://anotherwrapper.com/llm-pricing/gpt-6-luna) (**unverified** on OpenAI's page) |
| gpt-5-nano (older) | $0.05 | $0.005 | – | $0.40 | $0.025 / $0.20 | yes / yes | [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) |
| **DeepSeek V4 Flash** (direct API) | $0.30 **or** $0.14 | $0.006 **or** $0.0028 | – | $1.20 **or** $0.28 | none found | yes / yes | **Conflict:** [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) (cites api-docs.deepseek.com) gives $0.30/$0.006/$1.20. [eesel](https://eesel.ai/blog/deepseek-v4-flash-pricing), [Puter](https://developer.puter.com/tutorials/deepseek-api-pricing/) and [trevorfox](https://trevorfox.com/tools/calculators/llm-cost/deepseek/deepseek-v4-flash/) give $0.14/$0.0028/$0.28. **Unverified** |
| DeepSeek-V4.1-Flash on Google Cloud | $0.30 | $0.03 | – | $1.20 | – | – | [Google Cloud pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing) ("no charge until Oct 16, 2026") |
| gpt-oss-120b, Groq | $0.15 | $0.075 | – | $0.60 | – | yes / yes | [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) |
| gpt-oss-120b, Google Cloud | $0.09 | – | – | $0.36 | $0.045 / $0.18 | – | [Google Cloud pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing) |
| gpt-oss-120b, Together | $0.15 | – | – | $0.60 | – | yes / yes | [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) |
| gpt-oss-120b, Cerebras | $0.35 | – | – | $0.75 | – | yes / yes | [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) |
| gpt-oss-120b, Workers AI | $0.35 | – | – | $0.75 | – | tools | [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) |
| gpt-oss-20b, Groq | $0.075 | $0.0375 | – | $0.30 | – | yes / yes | [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) |
| gpt-oss-20b, Together | $0.05 | – | – | $0.20 | – | – | [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) |
| gpt-oss-20b, Google Cloud | $0.07 | $0.007 | – | $0.25 | $0.035 / $0.125 | – | [Google Cloud pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing) |
| Gemma 4 26B, Google Cloud | $0.15 | $0.015 | – | $0.60 | – | – | [Google Cloud pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing) |
| Gemma 4 26B-A4B, Workers AI | $0.10 | – | – | $0.30 | – | tools | [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) |
| Gemma 4 26B / 31B, Gemini API | $0 (free) | – | – | $0 | – | yes / yes | [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json). Free-tier data terms likely apply (unverified) |
| Gemma 4 31B, Together / Cerebras | $0.39 / $0.99 | – | – | $0.97 / $1.49 | – | yes | [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) |
| Llama 4 Scout, Google Cloud / Together / Workers AI | $0.25 / $0.18 / $0.27 | – | – | $0.70 / $0.59 / $0.85 | Google Cloud $0.125 / $0.35 | tools | [Google Cloud pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing); [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) |
| Llama 4 Maverick, Google Cloud | $0.35 | – | – | $1.15 | $0.175 / $0.575 | – | [Google Cloud pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing) |
| Qwen3 30B-A3B, Workers AI | $0.051 | – | – | $0.335 | – | tools | [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) |
| Qwen3.8 27B, Groq / Cerebras | $0.80 / $0.99 | – | – | $4.00 / $1.49 | – | yes / yes | [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) |
| Qwen3.8-Flash, Together | $0.15 | – | – | $0.47 | – | – | [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) |

### Cited findings: billing rules
- **Claude Batch:** the Batch API gives "a 50% discount on both input and output tokens". The caching multipliers "stack with other pricing modifiers, including the Batch API discount". — [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- **Claude cache hits:** a hit costs 0.1x input on most models, but 0.05x on Opus 5.5 and Sonnet 5.5 ("$0.10 USD on Claude Sonnet 5.5"). — [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- **Claude US-only inference:** `inference_geo` US-only inference costs 1.1x on Claude 4.6+, Haiku 5.5's long-context rates included. Global routing is the default. — [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- **Claude tokenizer:** Claude 4.7+ "produces approximately 30% more tokens for the same text", so Claude token counts below are multiplied by 1.3. — [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- **Claude tool use:** tool use adds a system prompt of about 286–406 tokens per request, plus the tool schemas. — [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- **Gemini output:** Google lists output as "Text output (response and reasoning)", so thinking is billed at the output rate. — [Google Cloud pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)
- **Gemini 3.8 Flash promo:** the price is marked "through December 31, 2026" and rises to $1.50/$7.50 "Starting January 1, 2027". — [Google Cloud pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)
- **Flash-Lite asterisk:** the Flash-Lite rows carry a footnote: "Promotional pricing provided through 50% credits back on net spend on select models within a given period." The page doesn't make clear whether that footnote covers the global Flash-Lite prices. Whether 3.5/3.1 Flash-Lite prices will change is **unverified**. — [Google Cloud pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)
- **OpenAI reasoning:** reasoning tokens "are billed as output tokens", per the 2026-09-30 note. — [OpenAI reasoning](https://developers.openai.com/api/docs/guides/reasoning) (not re-fetched; host blocked)
- **OpenAI Batch:** about 50% off input and output for jobs completed within 24 h. LiteLLM's batch fields show exactly half for every gpt-5.x/6 model listed. — [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json); [intuitionlabs](https://intuitionlabs.ai/articles/batch-ai-processing-cost-turnaround)
- **OpenAI naming:** OpenAI's 2026 lineup now uses Astra / Sol / Luna names: gpt-6-astra $10/$50, gpt-6-sol and gpt-6.1-sol $2/$10, gpt-6-luna $0.10/$0.50. — [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json); [morphllm](https://www.morphllm.com/openai-api-pricing)
- **DeepSeek caching:** caching is automatic and best-effort, and the cache-hit price was cut to 1/10 of launch on 2026-04-26 (aggregator). — [eesel](https://eesel.ai/blog/deepseek-v4-flash-pricing)

### Inferences
- OpenAI "mini/nano" naming appears superseded by "luna" for new models. gpt-5.4-mini/nano are still listed.
- Haiku 5.5's price is now about the same as gpt-6-luna. Haiku's input is 1.3x larger because of the tokenizer.

### Gaps
- None of the OpenAI, DeepSeek, Groq, Cerebras, Together, OpenRouter or Workers AI pages could be opened (proxy block). Treat every non-Anthropic, non-Google figure as secondary-source.
- Whether a Gemini 3.8 Flash-Lite exists for text: LiteLLM lists only `gemini-3.8-flash-lite-tts`.
- OpenRouter's prices and free-model list weren't obtained.
- Groq / Together batch discounts weren't obtained.
- Which reasoning-effort levels gpt-6-luna and Haiku 5.5 support.

## Q2. Free tiers and their data-use terms

### Takeaway
Free tiers exist for the Gemini API (including Flash-Lite and Gemma) and Groq. Gemini's free tier uses your content to improve Google's products, so it doesn't suit household diet data. At ~$0.01–0.05 per plan on the paid tiers, a free tier saves pennies a month and isn't worth the data trade-off.

### Cited findings
- **Gemini free vs paid data use:** on the free tier, content is "used to improve our products". On the paid tier, content is "not used to improve our products". — [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) (quoted in the 09-30 note; not re-fetched today because the host was blocked). Secondary sources confirm the same split in October 2026. — [costbench](https://www.costbench.com/software/llm-api-providers/google-gemini-api/free-plan/)
- **Gemini free-tier models and limits:** free-tier models reportedly include Gemini 3.5 and 3.1 Flash-Lite. Limits are per project, in RPM/TPM/RPD; one estimate is ~15 RPM and 1,500 RPD for Flash. These figures are **unverified** and the sources conflict. — [yingtu](https://yingtu.ai/en/blog/google-gemini-api-free-tier-limits-2026); [tinkerllm](https://tinkerllm.com/blog/gemini-api-free-tier-limits-rate-quotas/)
- **Groq free tier:** it needs no card and is capped by rate limits. Sample limits for gpt-oss-120b and Qwen3.8 27B: 30 RPM, 1,000 RPD, 8K TPM, 200K TPD. Limits are per organisation. — [benchlm (Groq free tier)](https://benchlm.ai/free-tier/groq); [Groq community](https://community.groq.com/t/what-are-the-rate-limits-for-the-groq-api-for-the-free-and-dev-tier-plans/42)
- **Groq data retention:** no official free-tier data-retention terms were found. One aggregator lists "no data privacy guarantees on free tier" as a complaint (**unverified**). — [eesel Groq pricing](https://eesel.ai/blog/groq-pricing)
- **Free open-model tokens:** Google Cloud listed DeepSeek-V4.1-Flash "at no charge until Oct 16, 2026", which has now ended. — [Google Cloud pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)

### Inferences
- One weekly plan is ~15–40K tokens (see Q4), which fits easily in Groq's 200K tokens/day and 8K TPM free limits only if a single request stays under 8K TPM. A 12K-token prompt would exceed an 8K-TPM cap, so on Groq's free tier the typical plan likely fails or needs the Developer tier.

### Gaps
- OpenRouter's free-model terms: whether prompts are logged or used for training per provider wasn't retrieved.
- Cerebras, Workers AI and Together free allowances weren't retrieved.

## Q3. Structured output, JSON schema and tool use

### Takeaway
Every shortlisted model supports function calling, and most support JSON-schema-constrained output. That covers Claude Haiku/Sonnet 5.5, all Gemini Flash/Flash-Lite models, gpt-5.4-nano/mini, gpt-5.6/6-luna, DeepSeek V4 Flash, and gpt-oss on Groq, Together and Cerebras. Some Workers AI models list tools but no schema mode.

### Cited findings
- LiteLLM flags `supports_response_schema` and `supports_function_calling` as true for: claude-haiku-5-5, claude-sonnet-5-5, gemini-3.8-flash, gemini-3.5-flash-lite, gemini-3.1-flash-lite, gemini-2.5-flash-lite, gpt-5.4-mini, gpt-5.4-nano, gpt-5.6-luna, gpt-6-luna, gpt-5-nano, deepseek-v4-flash, groq gpt-oss-120b/20b, together gpt-oss-120b, cerebras gpt-oss-120b, and groq/cerebras qwen3.8-27b. — [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json)
- LiteLLM lists Workers AI gpt-oss-120b, Gemma 4 26B and Qwen3 30B with function calling but without the response-schema flag. — [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json)
- Claude bills the tool-use system prompt (~286–406 tokens) and the tool schemas as input. — [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)

### Inferences
- Either return the whole weekly plan as one schema-constrained JSON object (an array of `{date, meal_time_id, recipe_id, servings_by_member}`) with no tool loop, or make one "write plan" tool call. Both avoid the multi-step tool loop that made planning cost $0.26 on gpt-5.4-mini in the 09-30 design.
- LiteLLM's flags are a secondary source. Strict schema adherence on small open models should be tested.

### Gaps
- Strict schema adherence and enum/ID validity on small models weren't measured. That needs the project's bake-off (#18).

## Q4. Tokens and cost per weekly plan and per month

### Takeaway
In the lean design, one weekly plan with 2 revisions costs about **$0.005–0.02** on the cheapest viable models: Haiku 5.5, gpt-6-luna, gpt-oss, Gemini 3.1 Flash-Lite, gpt-5.4-nano. That's **$0.02–0.08 per month per household**. gpt-5.4-mini or promo Gemini 3.8 Flash cost ~$0.05 per plan (~$0.20–0.24/month), and Sonnet 5.5 ~$0.17 (~$0.74/month). AI spend becomes negligible next to hosting. The 09-30 chat-heavy design cost ~$10/month.

### Token model (my estimates, not measured)
- **Input, first draft.** These sum to ~12K for 2–4 Members and ~100 Recipes, ranging 8K (50 Recipes) to 18K (150 Recipes, 4 Members):
  - Instructions and the output schema: ~2K
  - Preferences and dislikes: ~0.4K per Member
  - Meal Times with kcal ranges: ~0.5K
  - Pantry: ~1–2K
  - Candidate Recipes summarised at ~60 tokens each (id, name, kcal/serving, protein, tags, key ingredients): 50 → 3K, 100 → 6K, 150 → 9K
- **Output.** Each meal slot is ~40–60 tokens of JSON (servings for each Member). For 21–35 slots that's 1–2K. Reasoning is assumed equal to visible output (1x) in the typical case and 2x in the heavy case, and is billed as output.
- **Revision.** Each revision re-sends the same prompt (cached if within the cache window), adds ~2–3K of new content (the previous plan plus feedback), and outputs a full plan again.
- **Scenarios:**
  - **A, lean.** Code picks the candidates and AI only ranks or assigns: 6K in, 2K out+reasoning, no revisions.
  - **B, typical.** 12K in, 3K out+reasoning, 2 revisions (each 12K cached + 2K new in, 3K out).
  - **C, heavy.** 18K in, 7.5K out+reasoning, 3 revisions (each 18K cached + 3K new, 7.5K out).
- **Batch** halves only the first draft. Revisions are interactive, so they're at standard price. Claude's first call is billed as a 5-minute cache write when revisions follow. Claude tokens are x1.3.
- **Month** = 4.34 plans. One Household Meal Plan covers all Members.

### Cost per plan (standard / batch first draft), and per month for scenario B

| Model | A lean | B typical | C heavy | B per month |
|---|---|---|---|---|
| gpt-oss-20b, Together | $0.0007 / $0.0004 | $0.0038 / $0.0032 | $0.0100 / $0.0088 | $0.016 |
| gpt-5-nano | $0.0011 / $0.0006 | $0.0045 / $0.0036 | $0.0136 / $0.0117 | $0.020 |
| DeepSeek V4 Flash ($0.14/$0.28 figure) | $0.0014 / $0.0007 | $0.0048 / $0.0036 | $0.0123 / $0.0100 | $0.021 |
| gpt-oss-20b, Groq | $0.0010 / $0.0005 | $0.0048 / $0.0039 | $0.0130 / $0.0112 | $0.021 |
| Qwen3 30B-A3B, Workers AI | $0.0010 / $0.0005 | $0.0051 / $0.0042 | $0.0142 / $0.0125 | $0.022 |
| Gemini 2.5 Flash-Lite (may be retired) | $0.0014 / $0.0007 | $0.0054 / $0.0042 | $0.0152 / $0.0128 | $0.024 |
| **gpt-6-luna** | $0.0016 / $0.0008 | $0.0066 / $0.0051 | $0.0187 / $0.0157 | $0.029 |
| gpt-oss-120b, Google Cloud | $0.0013 / $0.0006 | $0.0068 / $0.0058 | $0.0181 / $0.0159 | $0.030 |
| Gemma 4 26B, Google Cloud | $0.0021 / $0.0010 | $0.0082 / $0.0064 | $0.0229 / $0.0193 | $0.035 |
| **Claude Haiku 5.5** (x1.3) | $0.0021 / $0.0010 | $0.0086 / $0.0067 | $0.0243 / $0.0204 | $0.037 |
| gpt-oss-120b, Groq | $0.0021 / $0.0010 | $0.0096 / $0.0078 | $0.0261 / $0.0225 | $0.042 |
| gpt-5.6-luna | $0.0036 / $0.0018 | $0.0145 / $0.0115 | $0.0425 / $0.0362 | $0.063 |
| **gpt-5.4-nano** | $0.0037 / $0.0019 | $0.0149 / $0.0119 | $0.0440 / $0.0375 | $0.065 |
| DeepSeek V4 Flash ($0.30/$1.20 figure) | $0.0042 / $0.0021 | $0.0157 / $0.0121 | $0.0444 / $0.0372 | $0.068 |
| **Gemini 3.1 Flash-Lite** | $0.0045 / $0.0022 | $0.0181 / $0.0143 | $0.0531 / $0.0452 | $0.079 |
| Gemini 3.5 Flash-Lite | $0.0068 / $0.0034 | $0.0280 / $0.0225 | $0.0847 / $0.0726 | $0.122 |
| Gemini 3.8 Flash (promo) | $0.0120 / $0.0060 | $0.0476 / $0.0374 | $0.1368 / $0.1160 | $0.206 |
| gpt-5.4-mini | $0.0135 / $0.0067 | $0.0543 / $0.0431 | $0.1593 / $0.1357 | $0.236 |
| Gemini 3.8 Flash (2027) | $0.0240 / $0.0120 | $0.0951 / $0.0748 | $0.2736 / $0.2320 | $0.413 |
| Claude Sonnet 5.5 (x1.3) | $0.0416 / $0.0208 | $0.1695 / $0.1305 | $0.4789 / $0.4009 | $0.736 |

**Worked example (gpt-5.4-mini, B):**
- Draft: 12K × $0.75 + 3K × $4.50 = $0.0225
- Each revision: 12K × $0.075 + 2K × $0.75 + 3K × $4.50 = $0.0159
- Total: $0.0225 + 2 × $0.0159 = **$0.0543**

Prices are from the Q1 table. The script is at `/tmp/claude-0/-home-user-calorie-manager/21d57196-187e-595f-9319-cde991a74d98/scratchpad/cost.py`.

### Inferences
- **Output and reasoning tokens dominate** on every model: 55–75% of B's cost on gpt-5.4-mini. Capping reasoning effort and keeping the plan JSON compact (IDs, not names) is the biggest lever. Batch saves only ~20–25% in B because revisions are interactive. It saves 50% in A.
- **Daily use.** Even a heavy household on Sonnet 5.5 (C, ~$2/month) spends little on planning alone. In this design the real cost driver is any remaining daily AI use (Rebalance, chat logging). The 09-30 note put those at ~85% of the bill.
- **Cheapest viable shortlist** for quality and price, to test in a bake-off:
  1. Claude Haiku 5.5 ($0.009/plan). It's verified on the primary page and has the strongest schema and tool support.
  2. gpt-6-luna ($0.007, price unverified).
  3. gpt-5.4-nano ($0.015).
  4. Gemini 3.1 Flash-Lite ($0.018, paid tier).
  5. gpt-oss-120b on Groq or Google Cloud ($0.007–0.010).

### Gaps
- Every token count is an estimate. Real recipe-summary size, reasoning-token ratios and revision counts need measuring.
- Batch latency (up to 24 h) versus the planning workflow wasn't checked against the app's Schedules.

## Q5. Strategies that cut cost, including the Claude subscription route

### Takeaway
The biggest cut is architectural: code filters and scores candidates and does all the kcal arithmetic, and the model only picks or orders among ~30–60 IDs and returns compact JSON. With that, even mid-tier models cost cents a month. The ADR's Claude-chat-with-subscription route is $0 marginal cost, but it can't run unattended on a Schedule. It also depends on one Member's personal plan and its usage limits.

### Cited findings
- **Caching:**
  - Claude cache hits cost 0.1x input (0.05x on Sonnet 5.5). The 5-minute write costs 1.25x and pays off "after one cache read". — [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)
  - OpenAI and Gemini cache automatically for older models. OpenAI's in-memory cache lasts ~5–10 min. Gemini's implicit cache needs a 4,096-token minimum on 3.8 Flash. — [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching); [Gemini caching](https://ai.google.dev/gemini-api/docs/caching) (both via the 09-30 note)
  - Revisions within minutes hit the cache. A weekly first draft never does.
- **Batch:** 50% off on Claude, stacking with caching. — [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing) Google lists Batch as a pricing option and LiteLLM shows exactly 50% for the Gemini 3.x Flash/Flash-Lite models. — [Google Cloud pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing); [LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json)
- **Claude API vs claude.ai subscription:**
  - The Claude API is billed separately from claude.ai plans. The pricing page directs plan pricing to claude.com/pricing. — [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)
  - This repo's existing skills (`plan-week-cal`, `add-recipe-cal`, `rebalance-cal`) already implement the subscription route: the Member runs the plan in Claude chat, which writes to the Calorie Manager. That's the current ADR (see the skill list in the project environment).

### Inferences (trade-offs of each lever)
- **Code picks, AI ranks (scenario A):** about 4–8x cheaper than B. It also makes validation trivial, because the model can only choose IDs that code has already checked for kcal range and pantry fit.
- **Small model plus a validation loop:** code checks each slot's kcal against the Meal Time range, recipe IDs, and pantry stock. On failure it re-asks only for the failing slots, which is a ~1K-token repair, not a full re-plan. That keeps a $0.10/$0.50 model viable even with a higher error rate. Escalate to a mid-tier model (gpt-5.4-mini or Gemini Flash) only after two failed repairs.
- **Batch for the scheduled weekly draft:** use it if a delay of minutes to 24 h is acceptable (e.g. submit Friday night for a Sunday plan). Revisions must stay synchronous.
- **Claude chat subscription route ($0 marginal cost):**
  - Pros:
    - No API key, cap or ledger to manage.
    - Sonnet/Opus-class quality.
    - The skills already exist.
  - Cons:
    - It needs a human to start each run, so it can't fire from the app's Schedules or push.
    - It uses up the Member's plan usage limits.
    - It ties the Household's planning to one person's account.
    - The other Members can't trigger it from the app.
    - Terms for automating a consumer subscription weren't checked (**unverified**).
    - With API planning now ~$0.01–0.05/month on Haiku 5.5 or luna-class models, the money saved by the subscription route is negligible. The real reasons to keep it are quality and no new integration.
- **Hybrid:**
  - Keep Claude chat as the "power" path for re-planning conversations.
  - Add an API path for the unattended weekly draft on Haiku 5.5 or a luna-class model, with batch and a $1–2/month hard cap.

### Gaps
- No primary source was read on claude.ai plan usage limits or terms for programmatic use.
- No measured quality comparison of these small models on meal-planning constraints was found.
