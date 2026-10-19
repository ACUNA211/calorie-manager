# 12: AI cap counter

**What to build:** Every AI, Jev or translation call goes through one server helper (a Supabase Edge Function module) that records provider, tokens and estimated cost in a usage ledger and refuses the call once that provider's spend this calendar month reaches the cap ($5 by default, from settings). The Owner sees this month's spend per provider in Settings.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 05 (Households and Members), 69 (Run the database tests locally)

**Status:** done (awaiting a database test file)

- [ ] A usage ledger table with provider, model, input/output tokens, cost and time
- [x] The helper refuses a call over the cap with a clear error the app shows ("AI limit reached this month")
- [x] Prices per model live in one config place, not scattered
- [ ] Settings shows spend per provider against the cap
- [x] Tests cover under cap, exactly at cap and over cap

## Comments

- 2026-10-17: Built in worktree `restart-t12` (branch `restart-t12`). Migration `supabase/migrations/008_ai_usage_ledger.sql` adds `ai_usage` (household, optional member, provider, model, tokens, cost_usd, created_at; select-only for members, no client insert), `household_settings` (one row per Household, `ai_monthly_cap_usd` default 5.00, created by a trigger and backfilled; the cap lives here, not on `households`), and `public.ai_spend_this_month()` (SECURITY INVOKER, Owner only, spend per provider this UTC month). Pure cap rules in `supabase/functions/_shared/cap.ts`, prices in `prices.ts`, the Edge Function helper `ai-gate.ts` (`createAiGate`: `checkCap`, `recordUsage`, `withAiCap`, throwing `AiLimitError` with code `AI_LIMIT_REACHED`). Web: `AiSpendPanel.jsx` (rendered on the Household page), `lib/aiSpend.js`, `AiSpendPanel.strings.js`.
- 2026-10-17: Tests: Vitest for cap logic and the gate with a fake client (under, exactly at, over cap), and the panel with a mocked client. `npm run lint`, `build`, `test` (40 passing) and `format:check` pass. NOT RUN: no SQL, no Deno, no Supabase project. Migration 008 and the Edge Function are unexecuted, so the ledger box and the Settings box stay unticked until the DB test run. Known gaps: the cap can only be changed with the service role (no Owner setter yet); check-then-record is not atomic; a failed call records nothing; a failed insert after a successful call throws and drops the result; months are UTC.
- 2026-10-18: `supabase db reset` (001–033) and `supabase test db` run on the local stack: 22 files, 387 tests, all pass.
  Ticket 12 still has no pgTAP file, so its ledger and Settings boxes stay open.
