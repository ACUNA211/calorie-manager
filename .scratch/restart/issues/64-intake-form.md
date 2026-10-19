# 64: Intake form

**What to build:** An Intake form a Member fills in when joining (and can redo): the questions and formula from ticket 01's research. It suggests Targets, which the Member accepts or edits before they're saved. Dependents get no suggestion.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 01 (Research: which formula and calculator should the Intake form use?), 10 (Targets by hand)

**Status:** done (awaiting: you run `supabase db reset` + `supabase test db` locally for migration 042 and its pgTAP test, and check the Intake screen in the app)

- [x] The form asks the questions ticket 01 recommends, in both languages
- [x] The formula is a pure, unit-tested function matching ticket 01's examples
- [x] Suggested Targets are only saved after the Member accepts or edits them
- [x] The suggestion clamps at the Member's suggestion floor (default 1,200 kcal women / 1,500 men), a per-Member setting that can be changed or turned off (#70)
- 2026-10-19: Built. Migration 042 (`member_intake`, kept apart from `member_settings` because that table is readable by sharing Members; holds the answers and the floor setting), `lib/intakeLogic.js` (pure formula, `intakeLogic.test.js`), `lib/intake.js`, `components/IntakePage.jsx` at `/intake` (en + es, `intake` locale key). Targets save through `saveTargets` as in #10; nothing is saved until "Save these Targets". Not done or not verified: pgTAP test `supabase/tests/member_intake_test.sql` is written but not run (no local stack); no link to `/intake` yet (t91's Settings adds it); body fat % is not asked (research uses it only for the lean-mass protein figure, which is not implemented); the report has no numeric worked examples, so the tests' examples are hand-worked from its equation and factors; the exercise-to-activity-level thresholds (90 and 300 min a week) are my choice, not the report's; the top-bar title for `/intake` has no `shell.tabs.intake` key yet; the floor setting and answers save only with an accepted suggestion.
