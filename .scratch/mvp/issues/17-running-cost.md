# What does it cost to run each month?

Type: research
Status: resolved
Assignee: ACUNA211 (research agent)
Blocked by: 12

## Question

With the chosen stack and AI model, estimate the monthly running cost at one Member (MVP) and two Members (phase 3): hosting, database, scheduled jobs, push, and AI tokens for a typical day (logging via chat, check-ins, a Rebalance, the daily recap) plus the weekly reflection and planning. Flag which item dominates and any free-tier cliffs, and suggest a monthly spending cap.

## Answer

- **Monthly totals** (typical use, heavy use at 2x in brackets):
  - **MVP, 1 Member:** $0 for hosting, database, Schedules, push, backups and FoodData Central, plus AI. That's ~$10 ($20) with gpt-5.4-mini, ~$9 with Gemini 3.8 Flash at the promo price and ~$19 from 2027, or ~$37 ($75) with Sonnet 5.5.
  - **Phase 3, 2 Members:** $25 for Supabase Pro (~$35 if `dev` joins the Pro organisation), plus AI. That's ~$20 ($39) with gpt-5.4-mini, ~$18 / ~$37 with Gemini (promo / 2027), or ~$73 with Sonnet 5.5. All-in with gpt-5.4-mini that's **~$45 ($64)**.
- **What dominates:** in the MVP, AI tokens are the only real cost. In phase 3, Supabase Pro costs the most, unless the model is Sonnet 5.5, Gemini at 2027 prices, or use is heavy. About 55% of the AI bill is the uncached start of each Agent turn, since turns are hours apart and the cache expires in between. That's why the AI bill is about twice #11's estimate. Chat food logging is the most expensive job (~28%). The Friday reflection and planning together are ~15%.
- **Free-tier cliffs:**
  - Supabase Free pauses a project after a quiet week, and `dev` is most at risk.
  - The 500 MB database: pg_cron's run history needs a daily purge job.
  - The 5 GB of egress: the nightly `pg_dump` uses the most.
  - Vercel Hobby: going over a limit blocks that feature for up to 30 days, and Hobby is non-commercial use only.
  - Gemini doubles in price on 2027-01-01, and its free tier uses your content to improve Google's products.
  - GitHub turns off scheduled workflows in a public repo after 60 days with no activity.
- **Spending cap:**
  - **MVP:** a **$20/month hard limit** on the AI key, with alerts at $10 and $15. This replaces #12's $10 cap, which is now an alert only, because a typical month lands right at $10.
  - **Phase 3:** a **$40/month AI hard limit**, which comes to ~$65 all-in with Supabase Pro.
  - **Evals:** run them on their own $5 key.
  - **In-app guard:** a usage ledger in Supabase that logs each call's cost, switches scheduled jobs to plain templates at 80% of the cap and stops the Agent at 100%.
- **Unverified:** all token counts are estimates. #18 should record the real cost per prompt. Also unconfirmed: gpt-5.4-mini's reasoning levels, Gemini implicit-cache storage fees, and whether pg_cron activity alone stops a project pausing.

Details and citations: [../research/running-cost.md](../research/running-cost.md)

## Comments

**Research (2026-09-30):** Checked Vercel, Supabase, GitHub Actions, web push, FoodData Central, and the OpenAI, Gemini and Anthropic pricing pages. Built a per-call token model from #05, #08, #15 and #16. Findings, arithmetic and sources are in [../research/running-cost.md](../research/running-cost.md).
