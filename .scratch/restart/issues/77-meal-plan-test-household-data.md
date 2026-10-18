# 77: Give the meal plan test its Household data

**Type:** your task (not for an agent)

**What to do:** Ticket 36's kit only has one Member's data and no Hard rules. Fill in `.scratch/restart/research/meal-plan-test/inputs/hard-rules.json` (allergies and never-eat foods), add the other Members' Meal Times and Targets if the test should cover them, and confirm or correct the 16 Recipes' calories.

**Blocked by:** None (can start immediately)

**Status:** done

**Unblocks:** 76

- [x] Hard rules filled in
- [x] Other Members' Meal Times and Targets added, or confirmed not needed
- [x] Recipe calories checked

## Comments

2026-10-17: No Hard rules. Brenda added (`inputs/member-2.json`, copies of Sergio's Meal Times, breakfast at 11:00, no lunch; kit change noted on 36). Recipe calories: Sergio says real Recipes must be built from Food Library ingredients (as CONTEXT's Recipe already says); the test keeps the flat per-serving numbers as rough stand-ins (decided 2026-10-17); they are not real Recipes.
