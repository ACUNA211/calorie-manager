# 50: Cook made

**What to build:** On a Cook (Plan grid or Today), "Made it" marks the Cook made and takes all its ingredients off the Pantry. The Cook then holds its servings made.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 40 (Plan grid editing), 25 (Pantry page), 80 (Decide: Recipe servings, save and delete rules)

**Status:** ready-for-agent

- [ ] Marking made subtracts every ingredient's grams from the Pantry (never below zero)
- [ ] Missing Pantry items are listed but don't block marking made
- [ ] Undo restores the Pantry and the Cook's state
