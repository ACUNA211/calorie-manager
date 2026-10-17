# 38: Hard-rule filter

**What to build:** A tested server function: given a set of Members (everyone eating at a Meal Time), return the Recipes none of their Hard rules forbid. A Recipe is forbidden if any ingredient matches a forbidden food or group, or breaks a diet rule.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 37 (Preferences page), 28 (Recipes page)

**Status:** ready-for-agent

- [ ] Unit tests cover an allergy, a food someone won't eat, vegetarian and halal
- [ ] A Recipe with one forbidden ingredient is excluded for that whole group
- [ ] Members with no Hard rules get every Recipe
