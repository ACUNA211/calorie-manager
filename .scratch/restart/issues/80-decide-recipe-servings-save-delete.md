# 80: Decide: Recipe servings, save and delete rules

**Type:** your task (not for an agent)

**What to do:** Ticket 28 (Recipes page) made three calls you should confirm or change. Write each answer in ticket 28's Comments.

1. **Servings vs. cooked weight.** Right now "makes N servings" always divides the totals; a weighed cooked yield only sets grams per serving. Keep that, or say the intended rule.
2. **Atomic save.** Save writes the Recipe row, then its ingredient rows, in two calls (not one transaction). Say yes or no to moving save into one database function (a new migration with a pgTAP test).
3. **Deleting a Recipe a Cook uses.** It currently fails, because `cooks` reference `recipes` with no cascade. Pick: block it with a message, or detach the Cook.

Ticket 29 (star, tags, copy) added three more. Write these answers in ticket 29's Comments.

4. **Old tag column.** Meal Time tags now live in a join table; the unused `recipes.meal_time_tags` column is left in place. Drop it in a later migration, or keep it.
5. **Tags you can't see.** A tag on another Member's Meal Time shows as "a Meal Time you cannot see" and is kept on save. Keep that?
6. **Deleted original.** When the original Recipe is deleted, the copy stays but loses its "Variation of" link. Keep that? (Copies are never starred and are named "<name> (variation)".)

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

**Unblocks:** 28, 29, 50

- [ ] Three answers written in ticket 28's Comments
- [ ] Three answers written in ticket 29's Comments
- [ ] CONTEXT.md's Recipe entry updated if rule 1 changes
