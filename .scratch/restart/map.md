# Map: Calorie Manager restart (Household app)

Label: wayfinder:map

## Destination

A Household PWA: barcode Scan into one shared Pantry, a Household Recipe library, a weekly Meal Plan drafted by a cheap AI on a Schedule from Preferences and Meal Times, a Shopping list of what the Pantry lacks, per-Member logging of calories and macros, Rebalance and Voice commands through Jev, in English and Spanish, for well under $5 a month of AI.

## Notes

- Vocabulary: `CONTEXT.md`. Decisions: [ADR 0002](../../docs/adr/0002-household-pwa-with-cheap-ai.md) (Household PWA, bounded AI, $5 cap), [ADR 0003](../../docs/adr/0003-react-vite-pwa-on-cloudflare-and-supabase.md) (stack).
- Costs: [research/costs.md](research/costs.md).
- Tracker: local markdown. Tickets are `issues/NN-<slug>.md`; research goes in `research/`.
- The old maps (`.scratch/mvp/`, `.scratch/mvp-reset/`) are background only.

## Releases

1. **Foundation:** Household, logins and invites, Members and Dependents, Targets by hand, Food Library (English + Spanish names), Scan, Pantry, Recipes (typed or pasted), Meal Times, logging on Today, Leftovers, offline Shopping list and logging, English/Spanish, Week view, data moved from the current project. Research tickets run alongside: the Targets formula, the Jev/OpenAI Decisions test (25 English + 25 Spanish messages), and the Meal Plan model test (4 real weeks, Haiku 5.5 vs 2 cheap models).
2. **Planning:** Meal Plan grid, AI draft on a Schedule, Swap and Redraft, Shopping list with Bought / Have it, Web Push reminders (Meal Times and cook days).
3. **Jev:** Rebalance and Voice commands, on whichever provider wins each language in the test.
4. **Extras:** Intake form with the researched formula, label photo for unknown products, USDA MyPlate Kitchen import.

## Tickets

68 tickets in `issues/`, numbered in dependency order: 01–36 release 1, 37–56 release 2, 57–63 release 3, 64–68 release 4. Added later to release 1: 89–93 (app shell and navigation, prototype layouts, Settings screen, and two fixes from the 79 review). The frontier (no blockers): 01, 02, 15, 35, 36. What's built vs this plan: [research/built-vs-restart.md](research/built-vs-restart.md).

Your tasks: 69–79 are things only you can do (run the database tests, deploy, phone checks, API keys, decisions, review). Each is `Status: ready-for-human` and is listed in the Blocked by line of the agent tickets it holds up, so a ticket isn't closed until its human task is done. Start with the ones that have no blockers: 69, 70, 71, 72, 77, 79.

## Grilling decisions (2026-10-17)

Rounds 1–5 are recorded in CONTEXT.md and the ADRs above. Round 6: no safety rails; exercise later; Recipes are ingredients plus notes; the draft runs once a week, Friday 6pm by default, changeable.

## Later phases

- Exercise and burned calories (maybe a Health Connect sync)
- Cooking steps and a cooking mode
- Grocery prices and budget tracking
- Agent-suggested new Recipes
- Expiry dates on Pantry items
