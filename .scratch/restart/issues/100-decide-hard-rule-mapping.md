# 100: Decide: how Hard rules map foods to groups and diets

**Type:** your task (not for an agent)

**What to do:** Ticket 38's filter (migration 040, `private.food_tag_rules` and `private.hard_rules`) tags foods by keywords in their English and Spanish names and USDA category, and leans towards excluding a Recipe when unsure. Confirm or change each call below in this ticket's Comments; an agent then edits the rules.

1. Coconut is not a tree nut.
2. Oats count as gluten.
3. Vegetarian allows eggs, dairy and honey, and forbids gelatin.
4. Pescatarian allows fish and shellfish.
5. Halal blocks pork, alcohol, gelatin and unknown meat (plain "sausage", meat broth); slaughter isn't checked.
6. Kosher blocks pork, shellfish, gelatin, unknown meat, and any Recipe mixing meat with dairy.
7. Beef, pork and poultry groups also block unknown meat such as plain "sausage".
8. Meat-based broth or stock counts as unknown meat. Too aggressive?
9. Hidden ingredients (soy lecithin, wheat in a branded sauce) aren't caught unless the Member names that food in their own list. Acceptable?

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

**Unblocks:** 38

- [ ] Each of the nine answered in Comments
