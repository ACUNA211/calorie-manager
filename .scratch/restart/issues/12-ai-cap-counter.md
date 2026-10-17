# 12: AI cap counter

**What to build:** Every AI, Jev or translation call goes through one server helper (a Supabase Edge Function module) that records provider, tokens and estimated cost in a usage ledger and refuses the call once that provider's spend this calendar month reaches the cap ($5 by default, from settings). The Owner sees this month's spend per provider in Settings.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 05 (Households and Members)

**Status:** ready-for-agent

- [ ] A usage ledger table with provider, model, input/output tokens, cost and time
- [ ] The helper refuses a call over the cap with a clear error the app shows ("AI limit reached this month")
- [ ] Prices per model live in one config place, not scattered
- [ ] Settings shows spend per provider against the cap
- [ ] Tests cover under cap, exactly at cap and over cap
