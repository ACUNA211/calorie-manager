# 11: Display units

**What to build:** Each Member chooses metric or US display units. Everything stays stored in grams; one shared formatter turns grams into the chosen units (g/kg or oz/lb, ml/l or fl oz/cups for liquids where the food says so). Every screen that shows an amount uses this formatter.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 05 (Households and Members), 69 (Run the database tests locally), 88 (Decide: show liquids in ml / fl oz?)

**Status:** done (awaiting review)

- [x] A units setting on the Member, defaulting to US
- [x] One formatter function with unit tests for grams → oz/lb and back
- [x] Typing an amount in US units stores the right number of grams (tested)
- [x] No screen formats amounts on its own (search for raw "g" labels)

- 2026-10-17 (dispatcher): screens to convert now include Foods (14: per-100 g and per-serving tables), Recipes (28: ingredient grams, totals) and Meal Times.
- 2026-10-17 (worker, ticket 11): built in web/src/lib/units.js (one formatter and parser; US by default), useUnits.jsx (UnitsProvider in main.jsx), UnitsSetting.jsx on TargetsPage. Liquids are out of scope: no food data marks a liquid, so every amount is grams, oz or lb (user to confirm). Migration 031 (display_units, default us, column grant and RLS) and supabase/tests/member_display_units_test.sql are written but NOT run: ticket 69. Web checks: see the commit message. Checks run in web/: eslint exit 0 (no problems); vite build exit 0; vitest 63 files and 886 tests passed; prettier --check clean. Database tests not run here.
- 2026-10-18: `supabase db reset` (001–033) and `supabase test db` run on the local stack: 22 files, 387 tests, all pass.
