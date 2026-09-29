# Which tech stacks fit the MVP?

Type: research
Status: resolved
Assignee: ACUNA211 (research agent)
Blocked by:

## Question

Find 2–4 realistic stacks (framework, database, hosting, scheduler, AI model and provider) for this app, compare them, and recommend one. They must meet these constraints from earlier decisions:
- An installable PWA that is phone-first on Android and also works in a laptop browser (#01), with **web push notifications** on Android.
- Server-side **scheduled jobs in each Member's time zone** that run even when the app is closed: the Friday reflection and planning, the 9:30pm recap, meal-slot check-ins and the 3pm unbought-ingredient alert (#05).
- **Offline ticking** on the Grocery List that syncs later, and **live updates** across both Members' phones (#07).
- A relational database for Household data (Pantry, Meal Plan, Portions, Calorie Logs, Activity Log with undo).
- An Agent that chats with streaming and **tool calling** (read and write app data), with its behaviour defined in **markdown files**, calling USDA FoodData Central with an LLM fallback (#02).
- Two users. Cost and a solo developer's upkeep matter more than scale.

For each stack, cover setup effort, how each constraint is met, free-tier limits and the likely monthly cost at two users, and vendor lock-in. Also compare 2–3 AI models for this Agent (tool-use quality, cost per typical day of use, Spanish support for phase 3).

## Answer

- **Stack:** Supabase (Postgres, Auth, Realtime, Cron) with a Next.js PWA on Vercel Hobby. Per-Member Schedules run from one pg_cron job each minute that reads a Schedules table (Vercel Hobby cron is once a day only). Web push via standard VAPID Web Push. Hosting costs $0/month at two Members; move to Supabase Pro ($25) for backups and no pausing before real data matters.
- **Runner-up:** Cloudflare Workers + D1 + Durable Objects ($5/month): per-Member alarms and one Durable Object per Household fit Schedules and live updates well, but it's SQLite, auth is DIY and it's all Cloudflare-only. Firebase is out (not relational); Vercel + Neon needs Vercel Pro for cron.
- **AI model:** Claude Sonnet 5.5 ($2 / $10 per M tokens; about $14 per Member per month by a rough estimate). Sonnet 5 is now legacy at the same price. Haiku 4.5 is an option for cheap single-step parsing; Opus 5.5 for the weekly reflection if Sonnet falls short. Build on the AI SDK so the provider can be swapped.
- **No stack meets cleanly:** offline Grocery List ticking. It's a hand-built service-worker queue everywhere except Firebase.

Details and citations: [../research/stack-options.md](../research/stack-options.md)

## Comments

**Research (2026-09-29):** Compared four stacks (Supabase + Vercel, Cloudflare, Firebase, Vercel + Neon) and seven AI models against the #01/#02/#05/#07 constraints. Findings, prices and sources are in [../research/stack-options.md](../research/stack-options.md).
