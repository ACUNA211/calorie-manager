# Which stack and hosting do we build on?

Type: grilling
Status: resolved
Assignee: ACUNA211
Blocked by: 11

## Question

Given the stack research in "Which tech stacks fit the MVP?", which framework, database, hosting, scheduler and AI model/provider does the MVP use? What does the developer already know or prefer, and which trade-offs (cost, lock-in, upkeep) matter most?

## Answer

Stack A from [#11](11-stack-options.md), chosen for cost first, then upkeep, then learning, then lock-in.

- **Language and framework:** TypeScript throughout (the developer wants to learn it), with a Next.js PWA using Tailwind CSS + shadcn/ui. The app lives in an `app/` subfolder of `ACUNA211/calorie-manager`, and Vercel builds from that folder. GitHub Pages keeps serving the prototypes from the root.
- **Database, Auth, Realtime:** Supabase. There are two free cloud projects, `dev` and `prod`, with schema changes as SQL migrations through the Supabase CLI, and no local Docker.
- **Backups:** Supabase Free for the MVP beta, plus a nightly GitHub Action that runs `pg_dump` to somewhere private. Move to Supabase Pro ($25/month: never paused, daily backups) when the second Member joins in phase 3.
- **Hosting:** Vercel Hobby. This is valid while the app is private Household use. Going commercial would mean Vercel Pro ($20/month), and that's for later (see the map).
- **Agent runtime:** Next.js route handlers on Vercel (300 s limit). Supabase Edge Functions are not used.
- **Schedules:** one pg_cron job every minute reads the Schedules table, converts each Member's local time to UTC, and POSTs due jobs to a secret-protected Vercel route. That route runs the Agent, writes the Check-in and sends the push.
- **Push:** standard VAPID web push from the Vercel side.
- **AI:** the Messages API through the Vercel AI SDK, so the provider is a config change. The Claude Agent SDK is not used, because it runs a `claude` process per session with state on disk, which is a poor fit for short-lived functions. The app needs a **paid API key**: a Claude.ai subscription can't power it ("Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK." [Agent SDK quickstart](https://code.claude.com/docs/en/agent-sdk/quickstart.md)).
- **Model:** the cheapest model that passes a bake-off ([#18](18-model-bake-off.md)) of about 20 real prompts, run on gpt-5.4-mini, Gemini 3.8 Flash (paid tier) and Claude Sonnet 5.5. Until then the default is **gpt-5.4-mini** (about $5/month), with Sonnet 5.5 (about $14/month) as the fallback.
- **Spending cap:** **$10/month** on the API key during the MVP, as the target. [#17](17-running-cost.md) refines it from measured usage.

## Comments

**Grilling (2026-09-30):** Developer priorities are cost > upkeep > learning > lock-in. Cloudflare (runner-up) was dropped: it costs $5/month against $0, auth would be DIY, and its APIs are Cloudflare-only. The developer asked whether their Claude subscription could be used instead of API billing. It can't, per the Agent SDK docs quoted above. API billing is separate, and new Console accounts get a small trial credit.
