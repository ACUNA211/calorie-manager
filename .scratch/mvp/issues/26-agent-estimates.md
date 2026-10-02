# How does the Agent estimate calories and macros?

Type: research
Status: superseded
Assignee: ACUNA211
Blocked by:

## Question

#02 made an LLM estimate the fallback when FoodData Central has no good match (restaurant meals, home-cooked dishes, "chipotle burrito bowl with guac"), and the #20 prototype shows it as an orange "est." item the Member can log as is or swap for a Food Library food. How the Agent actually reaches that number hasn't been decided. Does it break a dish into likely ingredients and grams and look those up in FoodData Central, or give one number for the whole dish? What portion size does it assume when none is given ("a burrito bowl" from which restaurant)? Should it use published restaurant nutrition when it knows the chain, and how does it say where a number came from? Does it give a range or a confidence, and when should it ask a question instead of guessing? Once an estimate is logged, is it saved to the Food Library so the same food isn't estimated (and paid for) twice, and can a Member correct it for next time?

Macros come into it too. They're out of scope for the MVP, but the map notes FoodData Central already returns them, so the Food Library could store them from day one. If the Agent estimates calories, should it estimate protein, carbs and fat at the same time so estimated foods aren't the only ones missing them later? How accurate do the estimates need to be, and how would we test that (for example, against foods whose real values are known, as part of the #18 bake-off)?

Raised during the #20 review (2026-10-01). To review in the future; it doesn't block the other open tickets.

**Superseded (2026-10-01):** the MVP was re-charted as a smaller map: [Calorie Manager MVP (reset)](../../mvp-reset/map.md). Kept for reference.
