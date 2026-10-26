# 30: Paste a Recipe

**What to build:** "Paste a Recipe": the Member pastes recipe text (or a link's text). A server function makes one cheap AI call (through the AI cap helper) that returns name, servings, notes and an ingredient list with amounts. Each ingredient is matched to the Food Library or USDA and converted to grams. The Member reviews every match before saving. Nutrition always comes from the matched foods, never from the AI.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 28 (Recipes page), 12 (AI cap counter), 76 (Get API keys and run the research tests), 80 (Decide: Recipe servings, save and delete rules), 83 (Deploy the Edge Functions and set their secrets)

**Status:** done (awaiting AI key)

- [ ] Pasting a typical recipe gives a pre-filled Recipe editor with matched ingredients
- [x] Unmatched or unsure ingredients are highlighted for the Member to pick
- [x] Nothing is saved until the Member confirms
- [ ] The call is recorded in the AI ledger and refused over the cap
- [x] A test uses a recorded AI response (no live AI call in tests)

## Comments

- 2026-10-17: Built in worktree `restart-t30` (branch `restart-t30`). Edge Function `supabase/functions/parse-recipe/index.ts` is a thin wrapper over `supabase/functions/_shared/parse-recipe.ts` (handler, strict reply check, prompt). The call goes through `createAiGate` with `claude-haiku-5-5` (Anthropic, the cheapest model named in ADR 0002 and `prices.ts`: $0.10 in / $0.50 out per M tokens). The key is read from `ANTHROPIC_API_KEY`; nothing is written to a file. Web: `lib/pasteRecipe.js` (unit conversion, matching, review rows, resolving the draft, the function call), `components/PasteRecipe.jsx` and `PasteRecipeReview.jsx`, a "Paste a Recipe" button and an optional `initialDraft` on `RecipesPage`/`RecipeEditor`, and the `recipes.paste` locale keys in en and es. No migration; the call uses the existing `ai_usage` ledger (migration 008).
- 2026-10-17: Tests (mocked; no live AI call, no Deno, no Supabase project): the handler with a fake service client and a mocked `fetch` (under cap, over cap refused before any model call, no key, no household, bad input, provider error, non-Recipe reply), the reply check, the unit conversion, matching and review rows, and the screen flow against the recorded reply in `web/src/test/recorded/paste-recipe-chili.json`. The recorded reply was written by hand in the API's response shape; it is not a captured live response. `npm run lint`, `build`, `test` (31 files, 381 tests) and `format:check` pass. NOT RUN: Deno (`deno check` and the function itself), the migration-008 ledger against a real database, and any live AI call. So the "pre-filled editor" and "recorded in the ledger and refused over the cap" boxes stay unticked.
- 2026-10-17: Decisions to confirm: volume units (cup, tbsp, tsp, ml) assume water density and are flagged as approximate; a count ("2 eggs") uses the food's first serving weight, else asks for grams; a USDA food the Member picked is saved to the Food Library when they continue to the editor (the Recipe itself is saved only by the editor's Save); a failed read keeps the pasted text for a retry; the usage is recorded even when the reply fails the check (tokens were spent). Known gaps: each ingredient runs one search (library plus USDA), so a long recipe makes many USDA calls; the AI cap check is not atomic (ticket 12).
- Set the key and try it (you do this, not the agent): `supabase secrets set ANTHROPIC_API_KEY=<your key>` then `supabase functions deploy parse-recipe`, and from the app paste a recipe. To run the function locally: `supabase functions serve parse-recipe --env-file <a local env file with ANTHROPIC_API_KEY>`. Keep the key out of the repo.
- 2026-10-25: Ticket 80 decisions. (7) Volume units: keep water density, flagged "approximate". (8) USDA foods: keep saving them to the Food Library on Continue, even if the Recipe is then cancelled.
