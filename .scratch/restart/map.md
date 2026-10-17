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

## Grilling decisions (2026-10-17)

Rounds 1–5 are recorded in CONTEXT.md and the ADRs above. Round 6: no safety rails; exercise later; Recipes are ingredients plus notes; the draft runs once a week, Friday 6pm by default, changeable.

## Later phases

- Exercise and burned calories (maybe a Health Connect sync)
- Cooking steps and a cooking mode
- Grocery prices and budget tracking
- Agent-suggested new Recipes
- Expiry dates on Pantry items
