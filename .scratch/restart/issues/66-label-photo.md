# 66: Label photo

**What to build:** For an unknown barcode, a "Take a photo of the label" option: the photo goes to a server function that makes one cheap AI vision call (through the AI cap helper) to read the Nutrition Facts panel, then pre-fills ticket 20's form for the Member to confirm. Photos are stored in Supabase Storage for the Household.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 20 (Type in a label for an unknown barcode), 12 (AI cap counter), 83 (Deploy the Edge Functions and set their secrets), 96 (Phone check: label photo), 98 (Run the database tests for migrations 035 onward)

**Status:** done (awaiting: apply migration 035, set the AI key, deploy read-label, photograph a real label on the phone)

- [ ] A clear label photo pre-fills name, serving size, calories and the six macros
- [x] Nothing is saved until the Member confirms
- [ ] The call is recorded in the AI ledger and refused over the cap
- [x] Tests use a recorded AI response

## Comments

- 2026-10-18: Built in worktree `restart-t66`. Edge Function `supabase/functions/read-label/index.ts` is a thin wrapper over `supabase/functions/_shared/read-label.ts` (handler, strict reply check, prompt). One vision call to `claude-haiku-5-5` through `createAiGate` (same provider, model and `ANTHROPIC_API_KEY` as parse-recipe), so it is refused over the cap before any model call and recorded in `ai_usage` afterwards. The request carries only the photo's Storage path; the function downloads it with the caller's own sign-in, so the bucket policy decides access, and it refuses a path outside the caller's Household folder. Migration `035_label_photos_bucket.sql`: private `label-photos` bucket (5 MB, JPEG/PNG/WebP) with insert, select and delete policies on the first path folder = a Household the caller belongs to. pgTAP test `supabase/tests/label_photos_bucket_test.sql` (written, NOT RUN: no local stack). Web: `lib/labelPhoto.js` (shrink to 1600 px JPEG, upload to `<household id>/<uuid>.jpg`, call the function, map the reading to the form's text boxes, in ounces for US units), `components/LabelPhotoPicker.jsx` (camera input), shown at the top of ticket 20's `LabelForm`, which is the step after "Type in the label" for an unknown barcode; the form's own checks and Save button are unchanged, so nothing is saved until the Member presses Save. Locale keys under `labelPhoto` in en and es.
- 2026-10-18: Tests use `web/src/test/recorded/read-label-oat-drink.json`, a reply written by hand in the API's response shape (not captured from a live call). Covered: reply parsing, the pre-fill mapping (metric and US), the handler under and over the cap (over cap: 429, no model call, no ledger row), unreadable photo, bad path, missing photo, wrong type, no key, and the screen pre-filling the form with no save until Save. `npm run lint`, `build`, `test` (69 files, 956 tests) and `format:check` pass (full `npm test` is flaky on timeouts when other worktrees run at once; it passed on rerun). NOT RUN: Deno, the migration and pgTAP test, any live AI call, the phone camera. The first box (a clear label pre-fills) and the ledger/cap box stay unticked until checked against a real label and a real database.
- Do these (you, not the agent): apply migration 035 (`supabase db push`); `supabase secrets set ANTHROPIC_API_KEY=<your key>` if not already set for parse-recipe; `supabase functions deploy read-label`; on the phone open Foods, scan an unknown barcode, choose "Type in the label", press "Take a photo of the label", check the filled values against the package, save. Then look at the AI spend panel for the new ledger row, and share the real reply so the recorded response can be replaced with a captured one.
