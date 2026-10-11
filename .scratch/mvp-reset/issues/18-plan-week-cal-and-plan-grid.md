# /plan-week-cal and the Plan tab grid

Type: build
Status: open
Assignee:
Blocked by: [Artifact shell and the Meal Times tab](12-artifact-shell-and-meal-times.md), [Food Library, Recipes and /add-recipe-cal](13-food-library-recipes-and-add-recipe.md)

## What to build

Tables for Meal Plans (one per Sunday–Saturday week, draft/approved), Cooks (Recipe, cook day, servings made) and Portions (Cook, Meal Time, day, servings). The `/plan-week-cal` skill, started from `chat-plan/`'s instructions: reads Meal Times, Target, band and Recipes, drafts next week in chat (Set times held first, Planned filled within range, If room only while calories are left, days aimed at the band, only existing Recipes), and writes the draft to Supabase. The Plan tab shows the week grid (Meal Times × days, each Cook in its own colour, 🔥 on cook day, day totals and bars against the aim, a Cooks list with servings placed/made), read-only for now.

## Done when

- A real week can be planned by voice/chat in under 15 minutes and appears on the Plan tab
- Day totals on the grid match the Agent's numbers

## Notes

Grid design from #05's prototype, minus the chat drawer (ADR 0001).
