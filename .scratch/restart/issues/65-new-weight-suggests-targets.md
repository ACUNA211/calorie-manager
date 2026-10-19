# 65: New weight suggests Targets

**What to build:** When a Member logs a new weight, offer updated suggested Targets from the Intake formula. They apply only if the Member says yes.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 64 (Intake form), 32 (Weight log and trend)

**Status:** done (awaiting review)

- [x] Logging a weight shows an "Update your Targets?" suggestion when they'd change
- [x] Saying no keeps the current Targets
- [x] No suggestion for Dependents
- 2026-10-19: Built. `lib/weightSuggestion.js` (pure `decideTargetsUpdate` on `intakeLogic.suggestTargets`), `components/TargetsSuggestion.jsx` shown by `WeightPanel` after a weight is logged, `weightSuggest` locale key (en + es). Threshold: offered when the rounded Calorie Target or protein floor from the formula differs from the saved one (unset counts as different); carb/fat ranges alone do not trigger it. Yes saves all six figures through `validateTargets` + `saveTargets` (band untouched); No saves nothing. No offer for Dependents, Members without Intake answers, goal 'hand', under-18, or a weight that is not the newest (back-dated, or logged while viewing a past week). Verified by unit and component tests only (not run against the real app or database). Editing an existing entry does not trigger the offer; pregnancy is not stored, so it cannot be checked here.
