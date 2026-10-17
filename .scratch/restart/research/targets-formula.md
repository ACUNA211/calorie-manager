# Research 01: Targets formula for the Intake form

Date: 2026-10-17. Ticket: `.scratch/restart/issues/01-targets-formula-research.md`.

**Method and limits.** Search and fetch in this round reached abstracts, PMC full text for one ISSN stand, and several secondary summaries. Where a claim below rests only on a secondary source, it is marked **(secondary)**. Where I could not verify a number, it is marked **(unverified)** and should be checked before it goes into code.

## 1. Resting energy expenditure (RMR)

**Recommendation: Mifflin-St Jeor.** Male: 10 × kg + 6.25 × cm − 5 × age + 5. Female: the same with −161 instead of +5 ([Mifflin et al., Am J Clin Nutr 1990, doi:10.1093/ajcn/51.2.241](https://doi.org/10.1093/ajcn/51.2.241); equation confirmed from the abstract, per [QxMD calculator page](https://calculate.qxmd.com/storage/calculators/846/Mifflin-StJeorEquation.html)). The derivation sample was 498 healthy adults aged 19–78, measured by indirect calorimetry.

Independent review: Frankenfield, Roth-Yousey and Compher (2005) reviewed predictive equations for nonobese and obese adults. Mifflin-St Jeor predicted RMR within 10% of measured values for more people than any other equation tested ([J Am Diet Assoc 2005;105(5):775-89, doi:10.1016/j.jada.2005.02.005](https://doi.org/10.1016/j.jada.2005.02.005), abstract only). The same review warns of noteworthy individual errors and says older adults and some ethnic groups are under-represented in the studies. A 2011 PLoS ONE study of obese Spanish women also found Mifflin the most accurate of ten equations at baseline, but accuracy fell to about 24% within 10% after a diet ([PLoS ONE 2011, via DOAJ](https://doaj.org/article/5d972f2ab62f409db39c02e9e6dd9192)). Secondary sources say Mifflin is often within roughly ±10% for a typical person, and that individual error can be much larger.

**Harris-Benedict** (1919, revised 1984) is older and less accurate for most people in the Frankenfield comparison, since Mifflin beat it on the within-10% measure. I did not read its primary revision or a figure for it (**unverified**), so it is not recommended.

**Body-fat-known vs unknown.**
- **Unknown (default):** Mifflin-St Jeor. Use this for everyone.
- **Known and measured:** Cunningham (RMR = 500 + 22 × fat-free mass) is the usual choice when body fat is measured. I could not retrieve a primary source for its 1980/1991 citation or its validation (**unverified**), so do not implement it until a primary source is checked.
- **Katch-McArdle:** not recommended. I found no validation against indirect calorimetry in healthy adults or athletes. Its dialysis-population results were only slightly below a CKD reference equation, which does not establish accuracy in healthy adults.

**Uncertainty:** high for any single person (realistically about ±10% and sometimes more). The equation is a starting point, not a measurement. The weight trend is the real check.

## 2. Activity factor and how to ask

**Recommendation:** multiply RMR by a PAL factor. Use conventional multipliers for sedentary (about 1.2), lightly active (about 1.375), moderately active (about 1.55) and very active (about 1.725) (**unverified**: these are the common Harris-Benedict/Mifflin-era multipliers and I did not fetch a primary source for them in this round). The IOM/DRI EER equations use a different PA coefficient set (adult female PA coefficients 1.00 / 1.16 / 1.27 / 1.44, secondary via [Statistics Canada reproduction](https://www150.statcan.gc.ca/n1/pub/82-003-x/2008004/article/10703/t/5800493-eng.htm)), which should be checked against the [DRI report](https://www.nationalacademies.org/read/27957) before choosing.

**Asking:** self-reported activity overstates energy spent. Questionnaire studies find overestimates that grow with intensity, and larger overreporting in adolescents and people with higher body fat ([review and IPAQ study summaries](https://burnet.edu.au/knowledge-and-media/research-articles/the-international-physical-activity-questionnaire-overestimates-moderate-and-vigorous-physical-activ); one study found over-reporting of hundreds of minutes a week). Questionnaires rank people reasonably well but overstate absolute amounts. So:
- Ask for the job (sitting, mostly standing or walking, heavy physical work) and planned exercise sessions per week with type and length, not "how active are you".
- Default to the lower multiplier when unsure.
- Let the weight trend correct the number after 3–4 weeks (see section 3).

**Uncertainty:** medium-high. The answer is a rough category and will be off for many people.

## 3. Deficit or surplus, pace, and adapting as weight changes

**Pace.** The Academy's 2022 Adult Weight Management guideline offers, for adults with overweight or obesity, an energy deficit of about 500–750 kcal/day, or intake ranges of 1,200–1,500 kcal/day (women) and 1,500–1,800 kcal/day (men) adjusted to body weight, activity and preference (**secondary**: quoted from a draft by an advocacy site, [Academy AWM guideline page](https://www.andeal.org/topic.cfm?menu=6109); I did not read the final text, so confirm the exact numbers). ISSN's diets stand says the deficit can be larger for people with more body fat and that slower loss preserves lean mass better in leaner people, but gives no fixed kcal figure ([Aragon et al. 2017, ISSN position stand: diets and body composition, PMC5470183](https://pmc.ncbi.nlm.nih.gov/articles/PMC5470183/); fetched in full). The stand cites a weekly 0.7% of body weight outperforming 1.4% for a leaner group.

**Recommendation for the app:** a deficit of 500 kcal/day (about 1 lb or 0.45 kg a week) by default, with a choice of 250 or 750. Do not offer more than 750 (about 1.5 lb a week) through the Intake form.

**Static vs dynamic.** The common "3,500 kcal per pound" rule overstates weight change over time. The NIH Body Weight Planner, built on Hall's dynamic model, accounts for metabolic adaptation ([NIH Body Weight Planner page](https://niddk.nih.gov/research-funding/at-niddk/labs-branches/laboratory-biological-modeling/integrative-physiology-section/research/body-weight-planner); [Hall et al., Lancet 2011, web appendix](https://www.niddk.nih.gov/-/media/Files/BWP/Hall_Lancet_Web_Appendix.pdf); a 2018 validation against CALERIE data by Guo, Brager and Hall, Am J Clin Nutr 107(4):558-565, from secondary sources). The Planner page did not state its equations or inputs, and the model is not offered as a usable API, so I could not check its equations.

**Recommendation for the app (simple, checkable version):**
- Recompute RMR with Mifflin each time a new weight is logged. Mifflin's weight term alone means RMR falls about 10 kcal/day per kg lost, so the Calorie Target falls naturally.
- Keep the chosen deficit as a fixed amount below the new TDEE. Offer a suggestion only, as CONTEXT says.
- Do not implement a metabolic adaptation term. It is a later refinement, and the research for it is still at the modelling stage in this round.

**Uncertainty:** medium. The static arithmetic with Mifflin is simple and transparent but ignores adaptation. Over 8–12 weeks a real person may lose slower than the plan predicts. The weight trend should show this and trigger a suggestion, not a silent change.

**Gain goals:** this research did not cover a surplus for muscle gain or a weight-gain target. Leave them to hand-entered Targets for now.

## 4. Protein, fat and carbohydrate

**Protein floor (per body weight):** ISSN's 2017 stand says 1.4–2.0 g/kg/day for exercising people, supporting muscle growth and retention ([Jäger et al. 2017, doi:10.1186/s12970-017-0177-8](https://doi.org/10.1186/s12970-017-0177-8); range from a secondary summary; the full text was not fetched). ISSN's diets stand gives 2.3–3.1 g/kg **fat-free mass** for lean, resistance-trained people in a deficit, and says very high intakes may help body composition in that group ([Aragon et al. 2017, PMC5470183](https://pmc.ncbi.nlm.nih.gov/articles/PMC5470183/)).

**Recommendation:** Protein floor at **1.4 g/kg body weight** for every Member on a deficit. Show 2.0 g/kg as a comfortable top of range. Use the FFM figure only if body fat is measured and the Member does resistance training. Do not use the DRI number as the Target, since it is a minimum to avoid deficiency, not a target for a deficit.

**Carbs and fat (AMDR):** the Dietary Reference Intakes give adult ranges of 45–65% of energy from carbohydrate, 20–35% from fat and 10–35% from protein ([National Academies DRI tables, secondary table in search results](https://www.nationalacademies.org/read/27957)). A 2024 National Academies letter report is reconsidering whether the AMDR framework is still needed, so these figures may change ([same site](https://www.nationalacademies.org/read/27957/chapter/8)).

**Recommendation:** fat 25–35% of Calories (floor 20%), carbs the remainder as a range of 45–65%. Protein is fixed by the floor above. The app should show carb and fat as optional ranges, as CONTEXT says.

**Uncertainty:** medium for the protein floor (the ISSN range is for active people, and the lean-mass specifics are for lean trained people only). Low to medium for the AMDR figures, which are under review.

## 5. Dependents (children and teens)

**Recommendation: suggest nothing.** Dependents get no suggested Targets, as CONTEXT already says. Equations and deficit figures above are for adults. The Body Weight Planner is limited to adults 18+ and says so on its page. The AAP's 2023 clinical guideline on childhood obesity de-emphasises dieting and weight-loss targets for children (**secondary**: summaries only; [AAP policy statements page](https://www.aap.org/en/patient-care/institute-for-healthy-childhood-weight/aap-policy-statements-on-obesity/), not read). An adult sets any Dependent's Targets by hand.

**Uncertainty:** low on the recommendation itself, since the adult formula does not apply to children. I did not verify the AAP wording.

## 6. Questions for the Intake form

Adults (18+) only, as the Planner requires. Everything else is optional or hidden.

1. Date of birth or age in years (must be 18 or over for suggestions).
2. Sex, as used by the formula (Mifflin is sex-specific). Say "the formula uses this".
3. Height (cm or ft/in) and weight (kg or lb), using the Member's display units.
4. Body fat % (optional). Used only for the FFM protein figure, never for the RMR.
5. Work: sitting, mostly standing or walking, or physically heavy.
6. Planned exercise: sessions a week and typical length and type (or none).
7. Goal: lose weight, maintain, or hand-enter (gain and other goals go to hand entry).
8. Pace, if losing: 250, 500 or 750 kcal/day deficit (default 500).
9. Pregnant or breastfeeding? If yes, no suggestion (the Planner excludes these groups). Ask only this, no health questions.

## 7. Safety limits

- Protein: floor 1.4 g/kg body weight (ISSN 2017); top shown at 2.0 g/kg.
- Calorie floor for a suggestion: 1,200 kcal/day for women and 1,500 for men, the lower ends of the Academy's 2022 ranges (**secondary**). Below this, the suggestion is not offered; the Member may still set it by hand. This is a formula input, not a warning, which is consistent with CONTEXT's "no safety rails". Check that against the grilling decision before coding.
- Deficit cap: 750 kcal/day (about 1.5 lb a week) through the form.
- No suggestion for under-18s, pregnancy or breastfeeding.
- No suggestion for surplus goals in this version.

## 8. Recommended formula

1. RMR = Mifflin-St Jeor (sex-specific).
2. TDEE = RMR × PAL, chosen from the work and exercise answers, default lower value when unsure.
3. Calorie Target = TDEE − deficit (250 / 500 / 750), clamped at the floor in section 7.
4. Protein floor = 1.4 g/kg; Carbs and fat as ranges from the AMDR (fat 25–35%, carbs the rest, 45–65%).
5. On each new weight, recompute RMR and TDEE and offer an updated suggestion. Never apply it automatically.

Total uncertainty: a typical person's suggested Target may be off by 10–20%. The weight trend over 3–4 weeks is the correction.

## Draft Targets entry for CONTEXT.md (for review, not yet applied)

**Targets**:
A Member's daily aims, set by hand or suggested from the Intake form. The **Calorie Target** is a ceiling: a day counts as "under" against it. The suggestion for an adult uses Mifflin-St Jeor RMR times an activity factor from the Member's work and exercise answers, less a deficit of 250, 500 or 750 kcal a day, and is never set below 1,200 kcal (women) or 1,500 kcal (men). Protein is a floor of 1.4 g per kg of body weight. Carbs and fat are optional ranges (fat 25–35% of energy, carbs 45–65%). When a new weight is logged, a new suggestion is offered, never applied. Dependents get no suggested Targets. Fibre, sugar and sodium are recorded and shown, but have no targets yet.
_Avoid_: goal, plan, budget

## Sources

- Mifflin MD et al. 1990, Am J Clin Nutr 51(2):241-247. https://doi.org/10.1093/ajcn/51.2.241 (abstract via [QxMD](https://calculate.qxmd.com/storage/calculators/846/Mifflin-StJeorEquation.html))
- Frankenfield D, Roth-Yousey L, Compher C. 2005, J Am Diet Assoc 105(5):775-89. https://doi.org/10.1016/j.jada.2005.02.005 (abstract)
- PLoS ONE 2011 (obese Spanish women). https://doaj.org/article/5d972f2ab62f409db39c02e9e6dd9192 (abstract)
- Aragon AA et al. 2017, ISSN position stand: diets and body composition. https://pmc.ncbi.nlm.nih.gov/articles/PMC5470183/ (fetched)
- Jäger R et al. 2017, ISSN position stand: protein and exercise. https://doi.org/10.1186/s12970-017-0177-8 (summary only)
- Hall KD et al. 2011, Lancet, web appendix. https://www.niddk.nih.gov/-/media/Files/BWP/Hall_Lancet_Web_Appendix.pdf
- NIH Body Weight Planner. https://niddk.nih.gov/research-funding/at-niddk/labs-branches/laboratory-biological-modeling/integrative-physiology-section/research/body-weight-planner (fetched)
- National Academies, DRI and AMDR, and 2024 letter report. https://www.nationalacademies.org/read/27957
- Academy of Nutrition and Dietetics, Adult Weight Management guideline (2022). https://www.andeal.org/topic.cfm?menu=6109 (not read in full)
- AAP childhood obesity policy page. https://www.aap.org/en/patient-care/institute-for-healthy-childhood-weight/aap-policy-statements-on-obesity/ (not read)
- Statistics Canada reproduction of IOM EER equations. https://www150.statcan.gc.ca/n1/pub/82-003-x/2008004/article/10703/t/5800493-eng.htm (secondary)

## Could not verify

- Cunningham equation: primary paper and year not confirmed; no validation source read.
- Katch-McArdle: no primary validation against indirect calorimetry found.
- Activity multipliers 1.2 / 1.375 / 1.55 / 1.725: conventional values, not checked against a primary source.
- Body Weight Planner equations and inputs: not published on the page; the model is not checked.
- Guo et al. 2018 validation: from secondary summaries only.
- Academy 2022 numbers (deficit, calorie ranges): read from a draft quoted by a secondary site; final text not read.
- AAP 2023 wording on dieting for children: secondary only.
- ISSN 2017 protein range: secondary summary; full text not fetched.
- DRI AMDR figures: from a search table, not the original report page.
- Harris-Benedict: only the Frankenfield comparison result, no primary source.
