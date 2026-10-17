# 01: Research: which formula and calculator should the Intake form use?

**What to build:** Find the best-supported way to turn the Intake form's answers into suggested Targets (calories, protein floor, carb and fat ranges) for each Member. Use deep research against primary sources (peer-reviewed studies, position statements, Dietary Reference Intakes). Write the report to `.scratch/restart/research/`.

**Blocked by:** 70 (Decide: a minimum in suggested Targets?)

**Status:** done (awaiting review)

## What to cover

- Resting energy equations (Mifflin-St Jeor, Harris-Benedict, Katch-McArdle, Cunningham, newer ones) and how accurate each is, including with body-fat percentage known or unknown
- Activity factors, and how to ask about activity so people answer it accurately
- Turning a goal and pace into a daily deficit or surplus, safe minimums, and how to adapt as weight changes (static 7,700 kcal/kg vs dynamic models such as the NIH Body Weight Planner)
- Protein, fat and carb recommendations by goal (ISSN, Academy of Nutrition and Dietetics, DRIs, AMDRs)
- What to do for Dependents (children and teens): whether to suggest anything at all
- Which questions the Intake form should ask

## Done when

- [x] A cited recommendation for the formula, the form's questions and the safety limits, with the uncertainty of each step stated
- [x] The Targets entry in CONTEXT.md can be written from it

## Comments

From the restart grilling (2026-10-17): don't lock a formula until this is done. Targets can always be set by hand.
- 2026-10-17: Research done, report at `.scratch/restart/research/targets-formula.md`. Pick: Mifflin-St Jeor RMR x activity factor, deficit 250/500/750 kcal (default 500), protein floor 1.4 g/kg, fat 25–35%, Dependents get no suggestion. Unverified: Cunningham, activity multipliers, Academy 2022 and AAP numbers (secondary sources), Body Weight Planner equations. Needs review, and a decision on the calorie floor vs "no safety rails" in CONTEXT.
