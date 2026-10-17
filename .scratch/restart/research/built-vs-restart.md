# What's built vs the restart

Compared 2026-10-17: the code on `main` (`supabase/migrations/001–004`, `app/calorie-manager.html`, `app/barcode-test.html`, `skills/*`, `.scratch/mvp-reset/issues/`) against `CONTEXT.md`, ADR 0002, ADR 0003 and `map.md`.

**Keep** carries over as is. **Adapt** keeps the idea or code but changes it. **Rewrite** keeps the design but not the code. **Drop** is gone in the restart. **New** has nothing built yet.

## Database (Supabase)

| Built | Verdict | What changes |
|---|---|---|
| `usda_search`, `usda_get` (Vault key, retries, rate-limit message), `store_section_for` | **Keep** | Callable from an Edge Function or by signed-in Members instead of only the connector |
| `usda_lookup_gtin`: strips leading zeros, matches `gtinUpc`, newest `publishedDate` first, checks the local Food Library first | **Keep** | Matches the research recommendation exactly; add the Open Food Facts fallback after it |
| `usda_kcal`: energy 1008, then 2047/2048 | **Keep** | Matches the research |
| `usda_save`: 4·carb + 4·protein + 9·fat sanity check, serving sizes in grams | **Adapt** | Also store protein, carbs, fat, fibre, sugar, sodium; add a Spanish name |
| `foods` (source, source_id, gtin, brand, kcal per 100 g, servings, store_section) | **Adapt** | Add macros, `name_es`, `source` values `off` and `label_photo`; drop `estimated` |
| `recipes`, `recipe_ingredients` (grams, cooked weight, servings, copied_from, meal_time_tags, starred, notes), `recipe_totals` | **Adapt** | Add `household_id`; `recipe_totals` adds macros |
| `meal_times` (Set / Planned / If room, weekdays, ranges) | **Adapt** | Add `member_id`; shared Meal Times need a Meal Time ↔ Member link |
| `meal_plans`, `cooks`, `portions` | **Adapt** | `household_id` on plans; `portions.member_id`, and the unique key becomes (member, Meal Time, date); `cooks` gains a made state; Leftovers come from servings made minus Portions logged |
| `calorie_log` | **Adapt** | Add `member_id` and macros; an entry can come from a Pantry item |
| `member_settings` (one row: Calorie Target, Planning band) | **Adapt** | Becomes Targets per Member (calorie ceiling, protein floor, carb and fat ranges, band) |
| `grocery_list` + `sync_shopping_list`, `shopping_measure`, `approve_meal_plan`, `cooks_sync_trigger` | **Adapt** | Lines become "needed minus Pantry"; ticks become Bought / Have it and change the Pantry; `household_id` |
| RLS enabled with zero policies (connector only) | **Rewrite** | Household policies through a `SECURITY DEFINER` helper |
| Starter Meal Times note in `004` | **Keep** | Seed for your Member |
| Your current rows (foods, Recipes, Meal Times, plans, list) | **Keep** | Moved into your Household as its first Member (decided in Q31) |

## App (`app/calorie-manager.html`, a Claude artifact)

| Built | Verdict | What changes |
|---|---|---|
| Today: next meal first, day arrows, log by search / USDA / label / type calories, confirm planned meals, Undo toasts | **Rewrite** | Design carries over (#07, #22); React + Vite, per Member, macros, Scan buttons (Add to Pantry / Eaten), Pantry items, Leftovers, Voice button later |
| Plan grid: week grid, Portions, edit, approve | **Rewrite** | Design carries over (#05, #19); adds Members per Portion, shared Meal Times, Swap, Redraft |
| Shop: one list, store sections, line ages, extra lines | **Rewrite** | Design carries over (#06, #20, #21); Bought / Have it, offline |
| Recipes: list + Recipe Facts editor | **Rewrite** | Design carries over (#04, #13); paste-to-parse, macros |
| Times: Meal Times week grid with day totals | **Rewrite** | Design carries over (#03, #12); per Member and shared |
| Week view | **Rewrite** | Design carries over (#09, #24); adds macros and weight trend, Household panel |
| Estimate button (Claude guesses calories) | **Drop** | Logging is plain code now; the label photo replaces it for unknown products |
| Data access through `window.claude` MCP `execute_sql` (raw SQL strings) | **Drop** | Works only inside Claude and needs the service role; replaced by supabase-js under RLS |
| Small helpers (dates, week-of, servings fractions, `norm` accent-folding search) | **Keep** | Port into the new app |

## Barcode

| Built | Verdict | What changes |
|---|---|---|
| `app/barcode-test.html`: native `BarcodeDetector` first, `@zxing/library` fallback, UPC-A/E and EAN-13/8 | **Adapt** | Swap `@zxing/library` (unmaintained) for the zxing-wasm `barcode-detector` polyfill; test on both Androids and one iPhone |
| #11 phone test (open), #17 Scan (blocked on it) | **Adapt** | #11 becomes a PWA test, not an in-Claude test; #17 is replaced by the new Scan ticket |

## Skills (Claude chat)

| Built | Verdict | What changes |
|---|---|---|
| `plan-week-cal` rules (Meal Time ranges, Planning band, Set calories set aside, Cooks feeding several Meal Times) | **Adapt** | Rules become the planning prompt plus a code validator; the skill itself retires |
| `rebalance-cal` rules (never Set or logged, not below `cal_min`, quarter-serving steps, drop If room, never change `servings_made`, up to three options, smallest first) | **Adapt** | Become the fixed Rebalance formulas in code; Jev picks the kind of fix; spread across the week is capped at ~10% a day |
| `add-recipe-cal` (USDA lookup per ingredient, confirm calories) | **Adapt** | Becomes the paste-to-parse flow's matching and confirm step |

## Nothing built yet (new)

- Households, Members, Dependents, Owner, logins and invite links
- Pantry with exact amounts; Leftovers with a 4-day flag
- Macros everywhere; Targets per Member; Intake form (after the formula research)
- Preferences and Hard rules, with a code filter before planning
- Open Food Facts fallback (own table, attribution); label photo for unknown products
- English/Spanish switch, translation files, Spanish food names; display units per Member
- PWA shell: service worker, Home Screen install, offline queue for the Shopping list and logging
- Web Push reminders (Meal Times, cook days)
- Schedules on pg_cron: weekly draft (Friday 6pm by default), Shopping list on approve
- Edge Functions: AI draft, Swap, Redraft, Recipe parse, label photo, translation; AI cap counter ($5/provider)
- Jev interface with OpenAI Decisions / Clef / cheap-model fallback; Rebalance in the app; Voice commands
- Week view macros, weight trend, Household panel
- USDA MyPlate Kitchen starter import
- Cloudflare Pages hosting; data move from the current project
- Research tickets: Targets formula (01, written), Jev vs OpenAI test (25 English + 25 Spanish), Meal Plan model test (4 weeks), translation API free tiers

## Old tickets

- Resolved design tickets #03–#09: their layouts carry over as the designs for the rewrite.
- Built tickets #12–#24: their behaviour carries over as listed above; the code doesn't.
- #10 AI cost: replaced by `research/costs.md`.
- #25 cleanup (blocked): redo as a restart cleanup ticket (retire the skills and the artifact once the PWA replaces them).
