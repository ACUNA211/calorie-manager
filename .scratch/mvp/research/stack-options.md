# Which tech stacks fit the MVP?

Research for [issues/11-stack-options.md](../issues/11-stack-options.md). Sources checked 2026-09-29. Every claim cites the page it came from; "unverified" means I couldn't confirm it on a primary source.

## The question

Pick a framework, database, hosting, scheduler and AI model for a two-Member Household app. The hard constraints from earlier tickets:

1. An installable PWA, phone-first on Android, usable on a laptop, with **web push** on Android (#01).
2. **Server-side Schedules in each Member's time zone** that run while the app is closed: Friday reflection and planning, the 9:30pm Recap, meal-slot Check-ins at 8/12/6, and the 3pm unbought-ingredient alert (#05).
3. **Offline ticking** on the Grocery List that syncs later, and **live updates** across both Members' phones (#07).
4. A **relational database** for Household data, including the Activity Log with undo.
5. An Agent that **streams**, **calls tools** that read and write app data, has its behaviour in **markdown files**, and calls USDA FoodData Central (#02).
6. Two Members. Cost and one developer's upkeep beat scale.

## Constraints every stack shares

Some constraints are met in the browser, not by the stack, so they're the same everywhere:

- **Web push works with the app closed.** The Push API "gives web applications the ability to receive messages pushed to them from a server, whether or not the web app is in the foreground, or even currently loaded", and needs an active service worker. It is "Baseline Widely available … since March 2023". [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) The server side is standard Web Push with VAPID keys, which any Node/Deno/Workers backend can send (for example the `web-push` library). The library claim is unverified here, but it isn't tied to any vendor.
- **Offline ticking** is a service worker plus a local queue (IndexedDB) that is replayed when the connection comes back. The Background Synchronization API can replay the queue from the service worker even if the tab is closed, but MDN marks it "Limited availability … not Baseline because it does not work in some of the most widely-used browsers". [MDN Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API) MDN's compatibility data lists it in Chrome since version 49 (Chrome for Android mirrors that), and not in Firefox or Safari. [MDN browser-compat-data, SyncManager](https://github.com/mdn/browser-compat-data/blob/main/api/SyncManager.json) So it works on the MVP's Android phone but not on an iPhone or in Firefox on the laptop. Safe design: replay on the next app open or `online` event, and use Background Sync only as a bonus. **None of the four stacks gives offline sync of a relational database out of the box.** Firebase has it built in (see below), but only for its non-relational Firestore.
- **"Each Member's time zone"** isn't a native cron feature anywhere. Cron schedules fire in a fixed zone (Supabase's docs describe their examples in GMT [Supabase Cron quickstart](https://supabase.com/docs/guides/cron/quickstart)), so every stack uses the same pattern: one job every minute (or every 5) reads a `schedules` table, converts each Member's local time to UTC, and runs whatever is due. That makes Schedules editable in the app or by chat (#05) without redeploying. The one exception is Cloudflare's per-object alarms (stack B), which can be set to an exact UTC instant per Member.
- **Markdown behaviour files** are just files in the repo read at request time (or bundled at build time) and put in the system prompt. Every stack can do it. The cheap trick is prompt caching, since those files are the same on every call (see the AI section).

## Stacks compared

| | **A. Supabase + Next.js on Vercel** (recommended) | **B. Cloudflare Workers + D1 + Durable Objects** (runner-up) | **C. Firebase (Firestore + Cloud Functions)** | **D. Next.js on Vercel + Neon Postgres + Vercel Cron** |
|---|---|---|---|---|
| Database | Postgres (relational) | D1 = SQLite (relational); plus SQLite inside each Durable Object | Firestore is a document DB, **not relational**. Postgres only via Data Connect / Cloud SQL, paid after a 3-month trial | Postgres (relational) |
| Scheduler | Supabase Cron (pg_cron) inside the DB; "every second to once a year"; can call an Edge Function over HTTP | Cron Triggers (5 per account on Free) or a Durable Object alarm per Member | Scheduled Cloud Functions (via Google Cloud Scheduler) | **Vercel Cron on Hobby: once a day, ±59 min.** Per-minute needs Pro ($20/month) |
| Live updates | Supabase Realtime (Postgres Changes / Broadcast) | WebSockets on a Durable Object (one per Household) | Firestore snapshot listeners | None built in; add a service (Pusher, Ably…) or poll |
| Offline ticking | Hand-rolled queue (see above) | Hand-rolled queue | **Built in** for Firestore (offline cache and write queue) | Hand-rolled queue |
| Auth | Supabase Auth, 50,000 MAU free | Build your own or add a service (unverified) | Firebase Auth | Add a service (Auth.js, Clerk…) |
| Agent runtime | Next.js route on Vercel: 300 s max per function on Hobby. Or a Supabase Edge Function: 150 s wall clock, **2 s CPU** on Free | Worker: **10 ms CPU per call on Free**, so realistically the $5 paid plan | Cloud Functions (Node) | Next.js route on Vercel, 300 s |
| Free-tier fit for 2 Members | Yes, but a free project **pauses after 1 week of inactivity**, and Vercel Hobby is "non-commercial, personal use only" | Paid plan needed for the Agent's CPU | Needs the pay-as-you-go Blaze plan to deploy functions | Cron limit forces Pro |
| Likely monthly cost (hosting + DB, excl. AI) | **$0** (Supabase Free + Vercel Hobby). $25 if you move to Supabase Pro to stop pausing and get backups | **$5** (Workers Paid minimum) | ~$0 usage on Blaze, but a card on file and no hard cap (unverified) | $20 (Vercel Pro) + Neon Free (unverified) |
| Setup effort (solo) | Low: DB, auth, realtime, cron and functions in one dashboard; SQL migrations | Medium: SQLite dialect, Durable Objects are a new mental model, auth is DIY | Low for Firestore, high if you need relational data | Medium: 3–4 vendors to glue together |
| Lock-in | Low. It's plain Postgres (dump and restore anywhere); pg_cron is an open-source extension; Next.js runs off Vercel | Medium-high. D1/Durable Objects/alarms are Cloudflare-only APIs | High. Firestore data model and security rules are Firebase-only | Low |

### A. Supabase (Postgres, Auth, Realtime, Cron, Edge Functions) + Next.js PWA on Vercel

- **Database:** Postgres, 500 MB per project on Free, 2 active free projects. [Supabase pricing](https://supabase.com/pricing) Household data for two Members is kilobytes to a few MB a year, so 500 MB is plenty. The Activity Log with undo is a normal table of before/after rows.
- **Scheduler:** Supabase Cron is "a Postgres Module that simplifies scheduling recurring Jobs with cron syntax", running "from every second to once a year", and it can "make an HTTP request, such as invoking a Supabase Edge Function". [Supabase Cron](https://supabase.com/docs/guides/cron) Sub-minute jobs use the syntax `30 seconds`, the examples are in GMT, and an Edge Function (or any URL) is called with `net.http_post(...)` from the `pg_net` extension. [Supabase Cron quickstart](https://supabase.com/docs/guides/cron/quickstart) So: one pg_cron job every minute calls an endpoint that finds due Schedules, runs the Agent, writes the Check-in and sends web push. Because it runs inside the database, it isn't limited by Vercel Hobby's once-a-day cron.
- **Live updates:** Supabase Realtime has three features: Broadcast ("send low-latency messages between clients"), Presence, and Postgres Changes ("listen to database changes in real-time"). [Supabase Realtime](https://supabase.com/docs/guides/realtime) Postgres Changes on the Grocery List table gives both phones live ticks. The Free plan includes 2 million Realtime messages a month and 200 peak concurrent connections. [Supabase pricing](https://supabase.com/pricing)
- **Agent:** Run it in a Next.js route handler on Vercel. Vercel Functions run up to 300 s on Hobby [Vercel Hobby](https://vercel.com/docs/plans/hobby), which is plenty for a streamed, multi-tool reply. Supabase Edge Functions are a worse home for it: 150 s wall clock on Free, 400 s on paid, and "Maximum CPU Time: 2s" per request. [Supabase Edge Function limits](https://supabase.com/docs/guides/functions/limits) Waiting on the model is async I/O and doesn't count as CPU, so it would probably fit, but there's no headroom.
- **Free-tier limits:** 50,000 MAU, 5 GB egress, 500,000 Edge Function calls. **"Free projects are paused after 1 week of inactivity."** [Supabase pricing](https://supabase.com/pricing) With daily use and a per-minute cron this shouldn't trigger, but I couldn't confirm whether cron activity alone counts as activity (unverified). Pro is $25/month, includes daily backups kept 7 days, and is "never paused". [Supabase pricing](https://supabase.com/pricing)
- **Vercel Hobby:** free, 1,000,000 function calls and 4 active-CPU hours a month, but "restricts users to non-commercial, personal use only". [Vercel Hobby](https://vercel.com/docs/plans/hobby) A private two-person Household app fits that. If this ever becomes a product (phase 2 in the map says "ready to be a full product"), it's Vercel Pro at $20 per developer seat per month. [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- **Cost at two Members:** $0 for hosting and database, plus AI tokens. $25–45/month if you want Supabase Pro backups and/or Vercel Pro.
- **Lock-in:** low. Supabase is Postgres, so the data leaves with `pg_dump`.

### B. Cloudflare Workers + D1 + Durable Objects (and the Agents SDK)

- **Pricing:** Workers Free gives 100,000 requests/day but only "10 milliseconds of CPU time per invocation". Workers Paid is a "$5 USD per month" minimum with 10 million requests and 30 million CPU-ms included. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) Parsing a long streamed Agent reply with tool calls will likely exceed 10 ms CPU, so plan on $5/month (my judgement, not measured).
- **Database:** D1 (SQLite) Free: 5 million rows read and 100,000 rows written per day, 5 GB storage. Durable Objects with SQLite storage are available on Free, with 100,000 requests/day. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- **Scheduler:** Cron Triggers are limited to 5 per account on Free and 250 on Paid; a Cron Trigger gets 10 ms CPU on Free, 30 s on Paid for intervals under an hour. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) One per-minute trigger that reads the Schedules table is enough. Alternatively each Member's Durable Object sets an alarm for its next Schedule. The Agents SDK wraps this: `this.schedule()` takes a delay in seconds, a `Date`, or a cron string, and "Scheduled tasks survive agent restarts and are persisted to SQLite"; "under the hood, scheduling uses Durable Object alarms to wake the agent at the right time". [Agents SDK: schedule tasks](https://developers.cloudflare.com/agents/api-reference/schedule-tasks/) So each Member's Agent can wake itself at the next local 8am without any polling. It's the neatest fit for constraint 2 of all four stacks.
- **Live updates:** a Durable Object per Household holds both phones' WebSockets and broadcasts changes. Elegant, but you write it.
- **Upkeep:** SQLite dialect, no built-in auth, and Durable Objects are a new model to learn. Everything is Cloudflare-specific, so moving away means a rewrite of the data and realtime layers.
- **Cost at two Members:** $5/month plus AI tokens.

### C. Firebase (Firestore, Cloud Functions, FCM, Auth)

- **Free quotas (Firestore Standard):** 1 GiB stored, 50K reads/day, 20K writes/day, 20K deletes/day. Cloud Functions list "No-cost up to 2M/month" invocations. Cloud Messaging is no-cost. [Firebase pricing](https://firebase.google.com/pricing)
- **But:** "to deploy functions, your project must be on the Blaze pricing plan" (pay-as-you-go), even if usage stays inside the free amounts. [Firebase: get started with Cloud Functions](https://firebase.google.com/docs/functions/get-started) Whether Blaze can be hard-capped wasn't checked (unverified).
- **Relational data:** Firestore isn't relational. The Household model (Portions per Member per meal, Pantry deductions, Grocery List merges, Activity Log with undo) is naturally relational. Firebase's relational option, Data Connect on Cloud SQL, has "a 3 month no-cost trial" and then starts at about $9.37/month. [Firebase pricing](https://firebase.google.com/pricing)
- **Strength:** offline ticking for free. On the web, offline persistence is off by default and turned on in code, and "when the device comes back online, Cloud Firestore synchronizes any local changes made by your app". Web support is "only by the Chrome, Safari, and Firefox web browsers". [Firestore offline data](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- **Verdict:** it fights constraint 4. Ruled out unless offline sync turns out to be the hardest part.

### D. Next.js on Vercel + Neon Postgres + Vercel Cron

- **Blocker on the free plan:** Vercel Cron on Hobby runs "once per day" at most, and a job set for 1am "will trigger anywhere between 1:00 am and 1:59 am". Per-minute cron needs Pro. [Vercel Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) Check-ins at 8, 12 and 6 in each Member's time zone can't be done on Hobby this way.
- Pro is $20 per developer seat per month. [Vercel Hobby](https://vercel.com/docs/plans/hobby) Neon's free tier wasn't checked this session (unverified).
- No built-in realtime or auth, so it's stack A with more vendors and more glue, and a monthly bill. **Only worth it if you want to avoid Supabase specifically.** An external free cron pinger could replace Vercel Cron, but that's one more moving part.

## AI model for the Agent

### Prices (USD per million tokens, from the providers' pricing pages)

| Model | Input | Cached input (read) | Cache write | Output | Notes |
|---|---|---|---|---|---|
| **Claude Opus 5.5** | $4 | $0.20 | $5 (5 min) | $20 | Default "start here" model; 1M context |
| **Claude Sonnet 5.5** | $2 | $0.20 | $2.50 | $10 | Current Sonnet; 1M context |
| **Claude Sonnet 5** | $2 | $0.20 | $2.50 | $10 | Now listed as **legacy** (Sonnet 5.5 replaced it); retirement not before 2027-06-30 |
| **Claude Haiku 4.5** | $1 | $0.10 | $1.25 | $5 | 200K context; retirement "not sooner than October 15, 2026" |
| OpenAI gpt-6.1-sol | $2 | $0.10 | – | $10 | |
| OpenAI gpt-5.4-mini | $0.75 | $0.075 | – | $4.50 | |
| Google Gemini 3.8 Flash | $0.75 | $0.075 | (+ storage $/hour) | $3.75 | Promo price through 2026-12-31, doubles to $1.50 / $7.50 from 2027 |
| Google Gemini 3.1 Pro Preview | $2 | $0.20 | (+ storage $/hour) | $12 | Preview; no free tier |

Sources: [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing), [claude.com/pricing](https://claude.com/pricing), [Claude models overview](https://platform.claude.com/docs/en/about-claude/models/overview), [Claude model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations), [OpenAI API pricing](https://developers.openai.com/api/docs/pricing), [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing).

Notes from those pages:
- **Sonnet 5 vs 5.5.** The ticket asked about "Sonnet 5". Anthropic's models page now lists Claude Sonnet 5.5 (`claude-sonnet-5-5`) as the current Sonnet and Sonnet 5 under "Legacy models (still available)". Both cost $2/$10; Sonnet 5's $2/$10 was introductory pricing that "is now the standard price", and the planned rise to $3/$15 "will not occur". [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing) So there's no reason to pick Sonnet 5 over 5.5.
- **Haiku 4.5's date.** It's "Active" with "Tentative retirement date: Not sooner than October 15, 2026", no deprecation announced, and Anthropic promises "at least 60 days' notice before model retirement". [Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations) So it can't disappear before about the end of November 2026, but it's the oldest model here (knowledge cutoff Feb 2025). [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview)
- **Opus 5.5 caching** is cheaper than usual: a cache hit is 5% of base input ($0.20). [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- **Tokenizer:** Claude 4.7 and later (so Opus 5.5 and Sonnet 5/5.5, not Haiku 4.5) use a tokenizer that "produces approximately 30% more tokens for the same text". [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing) Compare per-task costs, not per-token prices.
- **Tool use overhead:** adding tools adds a hidden system prompt of 286 tokens (Opus 5.5, Sonnet 5.5), 354 (Sonnet 5) or 496 (Haiku 4.5). [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing) Small next to our own tool schemas.
- **Gemini free tier:** content sent on the free tier is "used to improve our products"; on the paid tier it's "not used". [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) The Agent sees health-adjacent data (weights, what a Member ate), so use the paid tier.
- **Claude free credits:** "New users receive a small amount of free credits to test the API." [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)

### Cost of a typical day (one Member) — rough estimate

My assumptions, not measured (ticket #17 will refine them): about 15 Agent turns a day (chat logging, 3 Check-ins, one Rebalance, the 9:30pm Recap, a few questions), each turn averaging 2 model calls because of tool loops, so 30 calls. Each call sends ~8K tokens of markdown behaviour files and tool schemas (cacheable) plus ~3K tokens of fresh context (today's plan, Calorie Log, the message), and returns ~500 tokens. About 5 cache writes a day (the 5-minute cache expires between Check-ins).

| Model | Per day, 1 Member | Per month, 1 Member | Per month, 2 Members | Weekly reflection + planning (~60K in / 8K out) |
|---|---|---|---|---|
| Claude Opus 5.5 | ~$0.90 | ~$27 | ~$54 | ~$0.40 |
| Claude Sonnet 5.5 / Sonnet 5 | ~$0.47 | ~$14 | ~$28 | ~$0.20 |
| Claude Haiku 4.5 | ~$0.24 | ~$7 | ~$14 | ~$0.10 |
| OpenAI gpt-6.1-sol | ~$0.43 | ~$13 | ~$26 | ~$0.20 |
| OpenAI gpt-5.4-mini | ~$0.18 | ~$5 | ~$11 | ~$0.08 |
| Gemini 3.8 Flash (promo / 2027) | ~$0.17 / ~$0.34 | ~$5 / ~$10 | ~$10 / ~$20 | ~$0.08 / ~$0.15 |

Working (Sonnet 5.5): cache writes 40K × $2.50 = $0.10; cache reads 200K × $0.20 = $0.04; fresh input 90K × $2 = $0.18; output 15K × $10 = $0.15; total $0.47. Same method for the others, using the prices above (no cache-write premium for OpenAI and Gemini; Gemini's per-hour cache storage fee is left out). Add ~30% to the Claude 4.7+ rows if the token counts above were measured on an older tokenizer.

At this scale **AI tokens are the biggest monthly cost in every stack**, bigger than hosting.

### Tool use, streaming and Spanish

- **Tool calling and streaming:** all current Claude models "support text and image input, text output, multilingual capabilities, vision, and tool use". [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview) The AI SDK's provider table marks Anthropic, OpenAI and Google models as supporting both tool usage and tool streaming. [AI SDK providers](https://ai-sdk.dev/providers/ai-sdk-providers) I found no neutral, primary-source benchmark of tool-use quality across these exact model versions, so rank them by testing: run 20 real prompts ("2 eggs and toast", "swap Tuesday dinner", a Rebalance) against each and count correct tool calls. My expectation, unverified: the Opus/Sonnet and GPT flagship tier handles multi-step tool chains (look up FDC → compute → write Calorie Log → propose Rebalance) noticeably better than the Haiku/mini/Flash tier.
- **Spanish (phase 3):** Anthropic reports Spanish at 98.2% of English for Sonnet 4.5 and 96.4% for Haiku 4.5 (MMLU translated by professional translators). [Claude multilingual support](https://platform.claude.com/docs/en/build-with-claude/multilingual-support) It doesn't list Opus 5.5 or Sonnet 5.5 (unverified for them, but they're newer and larger). It also advises stating the response language in the system prompt, which fits #10: the Agent's markdown files can say "reply in the Member's language". I didn't check OpenAI's or Google's Spanish figures (unverified).
- **Provider-neutral code:** the AI SDK lets you pass tools to both `generateText` and `streamText` [AI SDK tools](https://ai-sdk.dev/docs/foundations/tools), and covers all three providers (above), so the model can be switched with a config change. That lowers model lock-in whichever stack wins.

## Recommendation

**Stack A: Supabase (Postgres + Auth + Realtime + Cron) with a Next.js PWA on Vercel Hobby, and Claude Sonnet 5.5 for the Agent.**

- It meets every hard constraint with managed pieces: relational Postgres, Realtime for live updates, pg_cron for per-minute per-Member Schedules (not limited by Vercel Hobby's daily cron), Auth for two logins, and Vercel functions (300 s) for the streaming Agent.
- It costs $0/month for hosting at two Members; only AI tokens cost money.
- Lock-in is low: Postgres dumps anywhere, and Next.js runs off Vercel.
- **Watch items:** (1) Supabase Free pauses a project after a week without activity, and has no backups, so move to Pro ($25) before the second Member's data matters; (2) Vercel Hobby is personal use only, so a real product launch means Vercel Pro ($20); (3) offline ticking is hand-built either way.

**Model: Claude Sonnet 5.5** (about $14 per Member per month by the estimate above). It's the current Sonnet, has strong tool use and Spanish, and costs half of Opus 5.5. Use **Haiku 4.5** for cheap single-step jobs (splitting "2 eggs and toast" into items, #02) if costs matter, but check its retirement notice first. Keep **Opus 5.5** for the weekly reflection and planning if Sonnet's plans aren't good enough (~$0.40 a week). Put the markdown behaviour files first in the prompt so they're cached. Write the Agent against the AI SDK so a switch to GPT or Gemini is a config change.

**Runner-up: Stack B (Cloudflare Workers + D1 + Durable Objects)** for $5/month. Per-Member alarms and one Durable Object per Household are a very good fit for Schedules and live updates, but auth is DIY, it's SQLite, and everything is Cloudflare-only.

**Constraint no stack meets cleanly:** offline ticking that syncs later. Only Firebase has it built in, and Firebase isn't relational. Every other stack needs a hand-written service-worker queue with a "last write wins" or "tick is idempotent" rule for when both Members tick the same line offline.

## Couldn't verify

These pages returned errors or didn't say, so these points are from memory or open:
- Whether pg_cron activity alone keeps a free Supabase project from pausing.
- Whether Supabase has any offline-sync support of its own (none found).
- Whether the Firebase Blaze plan can be hard-capped.
- Neon's free-tier limits (stack D).
- Auth options on Cloudflare (stack B).
- The `web-push` library for sending VAPID pushes (common knowledge, not re-checked).
- Tool-calling quality and Spanish performance for OpenAI and Gemini models.
- Spanish performance for Opus 5.5 and Sonnet 5.5 (Anthropic only publishes Sonnet 4.5 and Haiku 4.5 figures).
- Any neutral tool-use benchmark comparing these exact model versions.
- The per-day token counts: they are my estimates, for ticket #17 to measure.
