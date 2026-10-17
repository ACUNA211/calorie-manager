# 30: Paste a Recipe

**What to build:** "Paste a Recipe": the Member pastes recipe text (or a link's text). A server function makes one cheap AI call (through the AI cap helper) that returns name, servings, notes and an ingredient list with amounts. Each ingredient is matched to the Food Library or USDA and converted to grams. The Member reviews every match before saving. Nutrition always comes from the matched foods, never from the AI.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 28 (Recipes page), 12 (AI cap counter)

**Status:** ready-for-agent

- [ ] Pasting a typical recipe gives a pre-filled Recipe editor with matched ingredients
- [ ] Unmatched or unsure ingredients are highlighted for the Member to pick
- [ ] Nothing is saved until the Member confirms
- [ ] The call is recorded in the AI ledger and refused over the cap
- [ ] A test uses a recorded AI response (no live AI call in tests)
