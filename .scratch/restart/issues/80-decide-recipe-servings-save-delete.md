# 80: Decide: Recipe servings, save and delete rules

**Type:** your task (not for an agent)

**What to do:** Ticket 28 (Recipes page) made three calls you should confirm or change. Write each answer in ticket 28's Comments.

1. **Servings vs. cooked weight.** Right now "makes N servings" always divides the totals; a weighed cooked yield only sets grams per serving. Keep that, or say the intended rule.
2. **Atomic save.** Save writes the Recipe row, then its ingredient rows, in two calls (not one transaction). Say yes or no to moving save into one database function (a new migration with a pgTAP test).
3. **Deleting a Recipe a Cook uses.** It currently fails, because `cooks` reference `recipes` with no cascade. Pick: block it with a message, or detach the Cook.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

**Unblocks:** 28, 50

- [ ] Three answers written in ticket 28's Comments
- [ ] CONTEXT.md's Recipe entry updated if rule 1 changes
