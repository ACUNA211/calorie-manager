# What does it cost to run each month?

Research for [issues/17-running-cost.md](../issues/17-running-cost.md). Sources checked 2026-09-30. Every claim cites the page it came from; "unverified" means I couldn't confirm it on a primary source.

## Summary answer

**Monthly totals (30.4 days, typical use; heavy use = 2x in brackets)**

| | MVP: 1 Member (Supabase Free) | Phase 3: 2 Members (Supabase Pro) |
|---|---|---|
| Hosting, database, Schedules, push, backups, FoodData Central | **$0** | **$25** (Supabase Pro), or ~$35 if the `dev` project also moves into the Pro organisation |
| AI, gpt-5.4-mini (default) | **~$10** ($20) | **~$20** ($39) |
| AI, Gemini 3.8 Flash paid, promo price (to 2026-12-31) | ~$9 ($19) | ~$18 ($37) |
| AI, Gemini 3.8 Flash paid, from 2027-01-01 | ~$19 ($38) | ~$37 ($73) |
| AI, Claude Sonnet 5.5 | ~$37 ($75) | ~$73 ($146) |
| **Total with gpt-5.4-mini** | **~$10** ($20) | **~$45** ($64) |

- **What dominates:** in the MVP, AI tokens are the only real cost. In phase 3, Supabase Pro ($25) is the biggest line with gpt-5.4-mini or promo-priced Gemini, and AI tokens overtake it with Sonnet 5.5, Gemini at 2027 prices, or heavy use.
- **Inside the AI bill,** the biggest part (about 55%) is the uncached start of each Agent turn. The Agent's cached instruction block expires between turns because turns are hours apart. Output plus reasoning tokens are the next biggest part (about 38%). By job, chat food logging costs the most (~28%), then Rebalance, other chat and the 9:30pm Recap. The Friday reflection and planning together are only ~15%.
- **This is about twice #11's estimate** (~$5/Member for gpt-5.4-mini). That estimate assumed ~3K fresh tokens per call. #16 has since set a ~12K snapshot per call, and reasoning tokens are billed as output.
- **Free-tier cliffs:**
  1. Supabase Free pauses a project after 1 week of too little database activity. It sends a warning email a week before.
  2. The 500 MB database limit. pg_cron's run history is never cleaned up on its own, so add a daily purge job.
  3. The 5 GB Supabase egress. The nightly `pg_dump` is the biggest egress item.
  4. Vercel Hobby is for non-commercial use only. Going over a Hobby limit blocks that feature for up to 30 days rather than billing you.
  5. Gemini 3.8 Flash doubles in price on 2027-01-01.
  6. The Gemini free tier uses your content to improve Google's products, so don't use it.
  7. GitHub disables scheduled workflows in a public repo after 60 days with no repository activity.
- **Recommended cap:**
  - **MVP:** a **$20/month hard limit** on the AI provider, with alerts at $10 and $15. Keep #12's $10 as the alert, not the hard stop, because a typical month lands right at $10.
  - **Phase 3:** a **$40/month hard limit** on AI, plus Supabase Pro with its spend cap left on, so **~$65/month all-in**.
  - **In-app guard:** add one in both phases. It's a usage ledger in Supabase that switches scheduled jobs to plain templates at 80% of the cap and stops the Agent at 100%.

## Chosen stack, as priced here

From [#12](../issues/12-stack-and-hosting.md) and [#16](../issues/16-agent-files.md):
- A Next.js PWA on Vercel Hobby. The Agent runs in Vercel route handlers through the AI SDK.
- Supabase Free with `dev` and `prod` projects for the MVP. Only `prod` moves to Pro ($25) in phase 3.
- One pg_cron job each minute reads the Schedules table and POSTs the jobs that are due to a Vercel route.
- VAPID web push.
- A nightly `pg_dump` GitHub Action in the public repo `ACUNA211/calorie-manager`.
- USDA FoodData Central lookups, cached in the Food Library.
- Every Agent call sends the md instruction files and tool schemas (~8K tokens, cached) plus a ~4K snapshot and chat history. Tool results are capped at 4K, and no call may go over 100K.

## AI prices (USD per million tokens)

| Model | Input | Cached input (read) | Cache write | Output (incl. reasoning) | Source |
|---|---|---|---|---|---|
| gpt-5.4-mini | $0.75 | $0.075 | none | $4.50 | [OpenAI pricing](https://developers.openai.com/api/docs/pricing) |
| Gemini 3.8 Flash, paid, to 2026-12-31 | $0.75 | $0.075 | explicit cache storage $0.50 per 1M tokens per hour | $3.75 | [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Gemini 3.8 Flash, paid, from 2027-01-01 | $1.50 | $0.15 | storage $1.00 per 1M tokens per hour | $7.50 | [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Claude Sonnet 5.5 | $2 | $0.20 | $2.50 (5 min), $4 (1 h) | $10 | [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing) |

How each provider caches and bills:
- **OpenAI:** "Prompt caching is enabled by default". For models before GPT-5.6 (so gpt-5.4-mini) there's "no additional cache-write charge", and the in-memory cache lasts "typically around 5 to 10 minutes". The 24-hour extended retention list doesn't include gpt-5.4-mini. [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)
- **OpenAI reasoning:** reasoning tokens "are billed as output tokens". Effort levels include `none`, `minimal` and `low`, but "support varies by model". [OpenAI reasoning](https://developers.openai.com/api/docs/guides/reasoning) Which levels gpt-5.4-mini supports is unverified.
- **Gemini caching:** "Implicit caching is enabled by default for all Gemini 2.5 and newer models", with a 4,096-token minimum for 3.8 Flash, and "we automatically pass on cost savings if your request hits caches". [Gemini caching](https://ai.google.dev/gemini-api/docs/caching) Hits aren't guaranteed. Whether implicit caching carries a storage fee isn't stated (unverified; assumed none).
- **Gemini thinking:** "response pricing is the sum of output tokens and thinking tokens". 3.8 Flash thinks at medium by default, can go down to low, and can't be turned off. [Gemini thinking](https://ai.google.dev/gemini-api/docs/thinking)
- **Gemini free tier:** "Content used to improve our products". Paid tier: "Content **not** used to improve our products." [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- **Claude caching:** a 5-minute cache write costs 1.25x input and a hit costs 0.1x. [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing) The default TTL is 5 minutes and refreshes on use. There's an automatic mode that "places the cache breakpoint on the last cacheable block and moves it forward as conversations grow". The minimum cacheable prompt for Sonnet 5.5 is 512 tokens. [Claude prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- **Claude tokenizer:** Claude 4.7 and later use a tokenizer that "produces approximately 30% more tokens for the same text". [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing) So I multiply all Sonnet 5.5 token counts by 1.3.

## Token model

### Assumptions (mine, not measured; #18's bake-off should replace them)

1. **Call shape (from #16):** each model step sends the 8K instruction block, then a fresh part (snapshot, last 20 messages and the new message) of 4K, or 4.5–5K for scheduled jobs that add a `jobs/*.md` brief, then everything earlier in the turn (tool calls and tool results, each result ≤4K).
2. **Caching between turns:** turns are hours apart and caches last minutes, so **the first step of every turn is a cache miss**. That's full input price for OpenAI and Gemini, and a 1.25x cache write for Claude.
3. **Caching inside a turn (the tool loop):** later steps re-send the same prefix within seconds, so it's read from cache. Only the newest tool call and result are new. OpenAI and Gemini do this automatically. Claude does it with automatic caching. A **worst case** where only the 8K block is ever cached is shown separately.
4. **Reasoning/thinking tokens** equal the visible output (1x) for every model. They're billed as output. Real values depend on the effort level. A sensitivity check is below.
5. **Check-in jobs** run one short Agent step each (3/day). If Check-in pushes are templated in code (#14's text needs no model), this line drops to $0.
6. **The unbought-ingredient alert** (3pm) and the 7pm planning reminder are plain SQL plus templates, with no model call. A missing-ingredient swap the next day is counted under "other chat".
7. **Phase 3** doubles every per-Member job. Planning is one Household Meal Plan, so it's 1.5x (bigger, but still one plan). Spanish replies might use more tokens per word (unverified, not included).
8. **Heavy use** doubles every count: more chat, two Rebalances a day, and re-planning.

### Call types, per Member

Tokens are in thousands (K). "Cold" is the uncached input at the start of each turn (a cache write for Claude). "Cached" is cache reads. "Out" is visible output. The same amount is added again as reasoning.

| Call type | When | Count | Turns × steps | Cold | Cached | Out | Biggest single call |
|---|---|---|---|---|---|---|---|
| Chat food log ("2 eggs and toast": split, FoodData Central lookup, log, reply). Also covers a Check-in answered "Something else" | Chat | 4.5/day | 1 × 3 | 14.8 | 26.3 | 0.8 | 14.8K |
| Check-in job (scheduled, 8/12/6 +2h) | Schedules | 3/day | 1 × 1 | 12.5 | 0 | 0.15 | 12.5K |
| Other chat (questions, Pantry or Meal Plan edits) | Chat | 3/day | 1 × 2 | 13.8 | 12.0 | 0.6 | 13.8K |
| Rebalance (read Pantry, read remaining plan, propose, reply; then the Member's pick) | After a log | 1/day | 2 turns, 6 steps | 33.6 | 61.4 | 2.6 | 19.8K |
| 9:30pm daily Recap (job, then the Member answers cooked/leftovers) | Schedules | 1/day | 2 turns, 5 steps | 31.5 | 42.3 | 2.3 | 17.2K |
| Friday reflection (6 reads of the week, then write-up, then 2 reply turns) | Schedules | 1/week | 3 turns, 11 steps | 65.8 | 167.0 | 4.4 | 38.2K |
| Planning (8 reads, write the Meal Plan, one rule rejection and fix, reply; then 3 revision turns) | After reflection | 1/week | 4 turns, 20 steps | 111.2 | 411.2 | 15.8 | 53.9K |
| Grocery substitute | Chat from the list | 2/week | 1 × 2 | 14.3 | 12.0 | 0.7 | 14.3K |

- That makes 14.5 turns and 33.5 model steps a day, plus 9 turns and 35 steps a week.
- The biggest call is 53.9K (late in planning), inside #16's 100K limit.
- **Token totals for one Member per month:** 7.30M cold input, 10.46M cached input, 0.42M visible output plus 0.42M reasoning.

### Cost per occurrence (tool-loop caching on)

| Call type | gpt-5.4-mini | Gemini Flash 2026 | Gemini Flash 2027 | Sonnet 5.5 (x1.3 tokens) |
|---|---|---|---|---|
| Chat food log | $0.020 | $0.019 | $0.038 | $0.076 |
| Check-in job | $0.011 | $0.011 | $0.021 | $0.045 |
| Other chat | $0.017 | $0.016 | $0.032 | $0.064 |
| Rebalance | $0.053 | $0.049 | $0.099 | $0.193 |
| Daily Recap | $0.048 | $0.044 | $0.088 | $0.173 |
| Friday reflection | $0.10 | $0.09 | $0.19 | $0.37 |
| Planning | $0.26 | $0.23 | $0.47 | $0.88 |
| Grocery substitute | $0.018 | $0.017 | $0.034 | $0.068 |

**How one line is worked out (chat food log on gpt-5.4-mini):**
- Step 1 input is 8K + 4K = 12K cold, and it outputs 0.3K and gets a 2.0K FoodData Central result.
- Step 2 reads 12K from cache, sends 2.3K new, outputs 0.2K and gets a 0.3K write result.
- Step 3 reads 14.3K from cache, sends 0.5K new, and outputs 0.3K.
- Totals: cold 14.8K × $0.75 = $0.0111. Cached 26.3K × $0.075 = $0.0020. Output 0.8K × 2 (reasoning) × $4.50 = $0.0072. **Total $0.0203.**

### Per day, per week and per month

Month = day × 30.4 + week × 4.34.

| Scenario | gpt-5.4-mini | Gemini Flash 2026 | Gemini Flash 2027 | Sonnet 5.5 |
|---|---|---|---|---|
| 1 Member, typical: per day / weekly jobs | $0.27 / $0.39 | $0.26 / $0.36 | $0.52 / $0.72 | $1.03 / $1.39 |
| **1 Member, typical: month** | **$10.04** | **$9.41** | **$18.82** | **$37.36** |
| 1 Member, heavy (2x): month | $20.08 | $18.82 | $37.64 | $74.73 |
| 2 Members, typical: per day / weekly jobs | $0.55 / $0.66 | $0.52 / $0.61 | $1.03 / $1.21 | $2.06 / $2.33 |
| **2 Members, typical: month** | **$19.53** | **$18.32** | **$36.63** | **$72.82** |
| 2 Members, heavy (2x): month | $39.05 | $36.63 | $73.26 | $145.64 |
| *Worst case, only the 8K block cached: 1 Member typical* | $13.37 | $12.74 | $25.48 | $46.67 |
| *Worst case: 2 Members typical* | $25.77 | $24.56 | $49.13 | $90.10 |

**Check on the monthly total (1 Member, gpt-5.4-mini):** 7.30M × $0.75 = $5.47, plus 10.46M × $0.075 = $0.78, plus 0.84M × $4.50 = $3.80, which comes to **$10.05**. For Sonnet 5.5, the same tokens × 1.3 give 9.48M × $2.50 = $23.71, plus 13.60M × $0.20 = $2.72, plus 1.10M × $10 = $10.97, which comes to **$37.40**.

**Where the gpt-5.4-mini money goes (1 Member, per month):**

| By job | $/month | By token type | $/month |
|---|---|---|---|
| Chat food log | 2.77 | Cold input at the start of each turn | 5.47 (55%) |
| Rebalance | 1.62 | Output + reasoning | 3.79 (38%) |
| Other chat | 1.52 | Cached reads | 0.78 (8%) |
| Daily Recap | 1.44 | | |
| Planning | 1.11 | | |
| Check-in jobs | 0.98 | | |
| Friday reflection | 0.44 | | |
| Grocery substitutes | 0.16 | | |

### Sensitivity (1 Member, per month)

| Change | gpt-5.4-mini | Gemini 2026 | Gemini 2027 | Sonnet 5.5 |
|---|---|---|---|---|
| No reasoning tokens | $8.15 | $7.83 | $15.67 | $31.90 |
| Reasoning 3x visible output | $13.83 | $12.56 | $25.13 | $48.30 |
| Lean: templated Check-ins, Rebalance 2x/week, reasoning 0.5x | $7.12 | $6.73 | $13.45 | $26.84 |
| Lean, 2 Members | $13.76 | $13.01 | $26.02 | $51.99 |

**Levers that don't pay here:**
- **Gemini explicit caching:** keeping the 8K block cached all month costs 0.008M × $0.50 × 730 h = **$2.92/month** in storage. It saves only about 8K × $0.675/M × 15.5 turns × 30.4 = **~$2.55**. [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- **Claude's 1-hour cache:** it costs 2x to write, and most turns are more than an hour apart. [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- **OpenAI 24-hour retention** isn't offered for gpt-5.4-mini. [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)

**Levers that do pay:**
- Template the Check-in pushes and the 7pm reminder: −$1/month per Member.
- Set reasoning effort to the lowest level that passes #18.
- Keep the snapshot and chat history near #16's ~4K.
- Keep **`npm run agent:eval`** runs on a separate project/key with its own small cap, so eval spend doesn't eat the Members' budget. A 20-prompt run should cost well under $1 on gpt-5.4-mini and a few dollars on Sonnet (my estimate).

## Non-AI costs and free-tier fit

### Vercel Hobby ($0)

| Resource | Hobby allowance | Estimated use, MVP | Phase 3 | Source |
|---|---|---|---|---|
| Function invocations | 1,000,000 | ~150–300 cron POSTs (only due jobs, per #12) + ~500 Agent turns + ~6,000 page/API requests ≈ **7K**. If the cron POSTed every minute: +43,776 ≈ **50K (5%)** | ~13K (or ~57K) | [Vercel Hobby](https://vercel.com/docs/plans/hobby) |
| Active CPU | 4 CPU-hours | Waiting on the LLM isn't billed: "You are only billed during actual code execution and not during I/O operations (database queries, like AI model calls, etc.)". Estimate ~0.2 h (Agent ~0.3 s CPU per step, pages ~50 ms); +0.4 h if the cron POSTs every minute at ~30 ms each | ~0.4–0.8 h | [Vercel functions pricing](https://vercel.com/docs/functions/usage-and-pricing) |
| Provisioned memory | 360 GB-hours | Memory is billed for wall time, "even during I/O operations". Hobby always runs at 2 GB. Agent: 33.5 steps/day × ~6 s + weekly jobs ≈ 2.1 h × 2 GB ≈ **4 GB-h**; pages ≈ 1 GB-h; a per-minute cron at ~0.5 s ≈ +12 GB-h. **Total 5–17 GB-h (≤5%)** | 10–25 GB-h | [Vercel functions pricing](https://vercel.com/docs/functions/usage-and-pricing), [Vercel memory](https://vercel.com/docs/functions/configuring-functions/memory) |
| Max duration | 300 s | Longest call is planning (20 steps, split over 4 turns). One turn of ~11 steps at ~6–10 s each is 60–110 s, which fits | same | [Vercel Hobby](https://vercel.com/docs/plans/hobby) |
| Fast Data Transfer / CDN requests | 100 GB / 1M | Two phones and a laptop with a service-worker-cached PWA: MBs | same | [Vercel Hobby](https://vercel.com/docs/plans/hobby) |

- **On Hobby:** "if you exceed your usage limits on the Hobby plan, you will have to wait until 30 days have passed before you can use the feature again." Spend Management is "N/A" on Hobby, so it never bills. It stops instead. [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- **Commercial use:** "the Hobby plan restricts users to non-commercial, personal use only." Pro is "$20 per user / month". [Vercel Hobby](https://vercel.com/docs/plans/hobby)

### Supabase ($0 MVP, $25 phase 3)

| Quota | Free | Pro ($25) | Estimated use | Source |
|---|---|---|---|---|
| Database size | 500 MB | 8 GB, then $0.125/GB | App data ~100 KB/Member/day (chat messages dominate) ≈ **~35 MB/Member/year** (my estimate). pg_cron history: 1,440 rows/day, never cleaned up on its own (see cliffs) | [Supabase pricing](https://supabase.com/pricing) |
| Egress | 5 GB (+5 GB cached) | 250 GB, then $0.09/GB | Agent snapshot and tool reads ~1–2 MB/day, app ~5 MB/day, cron ~1 MB/day ≈ **~0.25 GB/month**, plus the **nightly `pg_dump`** (a 10–30 MB dump × 30 = **0.3–0.9 GB/month**). Query results returned to Vercel count: "Egress is incurred by all services - Database, Auth, Storage, Edge Functions, Realtime and Log Drains." | [Supabase pricing](https://supabase.com/pricing), [Supabase egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress) |
| Realtime | 2M messages, 200 peak connections | 5M, 500 | Grocery List ticks and table changes: a few thousand a month, 2–4 connections | [Supabase pricing](https://supabase.com/pricing) |
| Auth MAU | 50,000 | 100,000 | 1–2 | [Supabase pricing](https://supabase.com/pricing) |
| Edge Functions | 500,000 | 2M | 0 (not used, #12) | [Supabase pricing](https://supabase.com/pricing) |
| Projects | "Limit of 2 active projects" | Each project is billed for compute. "$10 in Compute Credits … cover one project running on the Micro/Nano Compute size"; Micro ≈ $10/month | `dev` + `prod` use both free slots | [Supabase pricing](https://supabase.com/pricing), [Supabase compute](https://supabase.com/docs/guides/platform/manage-your-usage/compute) |
| Backups | none | "Daily backups stored for 7 days" | nightly `pg_dump` on Free | [Supabase pricing](https://supabase.com/pricing) |
| Spend cap | n/a | "Spend caps enabled by default" | leave on | [Supabase pricing](https://supabase.com/pricing) |

- **Phase 3 cost:** $25 if only `prod` is on Pro. If `dev` sits in the same Pro organisation, it's billed another Micro instance (~$10), so ~$35. Whether `dev` can stay as a Free project in a separate free organisation after `prod` goes Pro is unverified.
- **Over quota on Free:** "you will get a notification to your billing email address and put under a grace period." [Supabase egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress)
- **pg_net:** stores each response "for 6 hours" and is built for "up to 200 requests per second". [Supabase pg_net](https://supabase.com/docs/guides/database/extensions/pg_net) At 1 POST a minute, that table stays tiny.

### Scheduled jobs, push, backups and FoodData Central ($0)

- **pg_cron:** runs inside the Supabase database, so it has no separate price. Every run is logged in `cron.job_run_details`, and "the records … are not cleaned up automatically". Supabase's own example deletes rows older than 7 days each night. [Supabase Cron quickstart](https://supabase.com/docs/guides/cron/quickstart)
- **Web push:** VAPID pushes to Chrome on Android go to Google's push service (FCM). Firebase lists "Cloud Messaging (FCM) - No-cost". [Firebase pricing](https://firebase.google.com/pricing) That this also covers plain VAPID Web Push without a Firebase project is unverified, as is the cost of Mozilla's push service for Firefox on a laptop. Neither has a published price that I found.
- **GitHub Actions (nightly `pg_dump`):** usage "is free for self-hosted runners and for public repositories that use standard GitHub-hosted runners". [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) The repo is public, so it's $0 (a private repo on GitHub Free would get 2,000 minutes a month, still enough). Also: "In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days." [GitHub: disabling a workflow](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/disabling-and-enabling-a-workflow) Because the repo is public, the dump must never be written to the repo or to a readable artifact. Encrypt it and send it to private storage. Whether Actions artifacts in a public repo are readable by others wasn't checked (unverified), so assume they are.
- **USDA FoodData Central:** the API key is free, with "1,000 requests per hour per IP address". Going over returns HTTP 429, and "the API key [is] temporarily blocked for 1 hour". [FDC API guide](https://fdc.nal.usda.gov/api-guide/) One Member makes ~10 lookups a day, and results are cached in the Food Library (#02), so this is nowhere near the limit. Vercel functions don't have a fixed IP, and a shared IP could hit the limit (unverified).

## Free-tier cliffs, in order of risk

1. **Supabase pausing (MVP).** "A Free plan project is considered inactive if it does not receive sufficient user database activity over the past week… Typically a few user requests to the database each day over the previous week is enough." A warning email comes "roughly one week before the pause". [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing) Whether pg_cron alone counts is unverified, but daily Agent and app queries should count. **The `dev` project is the one at risk** during quiet weeks. Phase 3's Pro plan is never paused. [Supabase pricing](https://supabase.com/pricing)
2. **The 500 MB database.** App data grows ~35 MB per Member per year (estimate). pg_cron history adds 1,440 rows a day forever unless purged. Row size is unverified; a third-party report puts it at ~100 MB/year. Add the 7-day purge job from day one. That leaves 500 MB good for several years.
3. **5 GB egress.** It's comfortable (~1 GB/month) as long as `pg_dump` dumps only the app's schemas, compressed, and the cron history is purged. A full dump that grows every night is the one thing that could creep toward it.
4. **Vercel Hobby limits.** Everything is under 5% of the limits. But over any limit, the feature stops for up to 30 days instead of billing you. Keep the cron filtering due jobs in SQL (as #12 says) so Vercel isn't woken 43,776 times a month for nothing.
5. **Vercel Hobby commercial rule.** It's fine for the Household. Selling it means Vercel Pro, $20 per seat per month (the map already defers this to after phase 3).
6. **Gemini promo ends 2027-01-01.** Input, output, cache and storage prices all double. [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) Phase 3 will likely start after that, so price Gemini at the 2027 rate for phase 3. At that rate it's about twice gpt-5.4-mini.
7. **Gemini free tier.** Content is "used to improve our products". The Agent sees what Members eat and, from phase 2, their weight. Use the paid tier only. [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
8. **Scheduled backups switched off** after 60 quiet days in the public repo (see above). Check the backup Action's last run as part of any monthly review.

## Spending cap: recommendation and enforcement

### How each provider caps spend

| Provider | Hard limit you set | Alerts | What happens at the limit | Source |
|---|---|---|---|---|
| OpenAI | Yes: organisation and **project** monthly spend limits, enforced as a hard limit | Spend alerts ("API traffic continues") | HTTP 429 `project_spend_limit_exceeded`. "Enforcement is not instantaneous… recorded spend can slightly exceed the configured amount." Resets monthly | [OpenAI spend limits](https://developers.openai.com/api/docs/guides/spend-limits) |
| Anthropic | Yes: "set your own spend limit below your tier's cap" on the Billing page; also per-Workspace limits | Not stated on this page | HTTP 400 `invalid_request_error`, "You have reached your specified API usage limits". Tier caps start at $500 (Start tier) | [Claude rate limits](https://platform.claude.com/docs/en/api/rate-limits) |
| Google Gemini | Project spend cap in AI Studio, but "**Experimental**… You are subject to overages for around a 10 minute latency period." Tier 1's account cap is $250. New AI Studio users must prepay at least $5 | Not checked | Service paused until the next cycle for a tier cap | [Gemini billing](https://ai.google.dev/gemini-api/docs/billing) |
| Supabase Pro | Spend cap, on by default | Billing emails | Usage is restricted at the cap (details unverified) | [Supabase pricing](https://supabase.com/pricing) |
| Vercel Hobby | Can't be billed | – | Feature blocked for up to 30 days | [Vercel Hobby](https://vercel.com/docs/plans/hobby) |

All three AI providers offer a real hard limit, but OpenAI's and Gemini's can overshoot slightly. Whether OpenAI and Anthropic API accounts are prepaid credits without auto-recharge (which would act as a second hard stop) is unverified; OpenAI's help page returned 403.

### Recommended caps

- **MVP (1 Member, gpt-5.4-mini expected at ~$10):**
  - **Provider hard limit: $20/month** on the Agent's project/key. It covers a heavy month ($20) and the bake-off/eval work.
  - **Alerts at $10 and $15.** Keep #12's $10 as the first alert rather than the hard stop. A typical month is right at $10, so a $10 hard stop would cut the Agent off near the end of many months.
  - If #18 picks Sonnet 5.5, the cap would need to be ~$50–75 for one Member. That's a strong reason to prefer the cheaper models if they pass.
- **Phase 3 (2 Members):**
  - **AI hard limit $40/month** (gpt-5.4-mini typical $20, heavy $39; Gemini at 2027 prices typical $37).
  - **Supabase Pro** with its spend cap on ($25, or ~$35 with `dev`).
  - **Planned ceiling: ~$65/month.**
- **Evals:** a separate project/key with its own **$5/month** hard limit.

### In-app guard (works on any provider, and catches the overshoot)

1. **Record usage on every call.** The AI SDK returns token usage per call (input, cached input, output). Write one row per call to a `ai_usage` table in Supabase: Member, job type, model, tokens, and dollars from a price table in code.
2. **Daily budget.** If one Member's spend today passes **$1** (about 3–4x a typical day), stop *scheduled* Agent runs for that Member for the rest of the day. Check-ins and the 9:30pm Recap fall back to plain templates (#14's texts work without a model). Chat still works.
3. **Monthly soft stop at 80% of the cap.** Scheduled jobs use templates. Planning still runs. The Agent says once in chat that it's saving budget. Show spend so far under ☰ → Settings.
4. **Monthly hard stop at 100%.** The Agent replies "The Agent is paused until the 1st", and the dashboard, + quick-entry and Food Library search keep working (dashboard-first, per the map).
5. **Handle the provider's own stop cleanly.** Treat OpenAI's `project_spend_limit_exceeded` 429, Anthropic's `invalid_request_error` "specified API usage limits" 400, and a Gemini cap pause as "paused", not as an error to retry. Anthropic notes that retries fail until access resumes. [Claude rate limits](https://platform.claude.com/docs/en/api/rate-limits)
6. **Existing guards:** the 100K-per-call limit and the 4K tool-result cap (#16) already stop a single runaway tool loop.

## Couldn't verify

- Which reasoning effort levels gpt-5.4-mini supports, and how many reasoning tokens each job really uses. That's the biggest uncertainty in the AI numbers, so #18 should record it.
- Whether Gemini implicit caching has any storage fee, and how often implicit hits happen.
- Whether OpenAI and Anthropic API billing is prepaid without auto-recharge (OpenAI's help page returned 403).
- Whether pg_cron activity alone keeps a Supabase Free project from pausing.
- The size of a `cron.job_run_details` row (the ~100 MB/year figure is from a third-party GitHub issue, not Supabase).
- Whether a Free `dev` project can stay in a free organisation after `prod` moves to Pro.
- The cost of sending VAPID Web Push through FCM without a Firebase project, and through Mozilla's push service.
- Whether GitHub Actions artifacts in a public repo are downloadable by others.
- Whether Vercel's shared outbound IPs could hit FoodData Central's per-IP limit.
- Every token count and call count in the token model. They are my estimates from #16's budget. Measure them in #18 and in the first two weeks of the MVP beta, then update this file.
