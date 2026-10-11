---
name: add-recipe-cal
description: Add, change, copy or delete a Recipe in Sergio's Calorie Manager, looking ingredients up in USDA and confirming calories before saving. Use when he says /add-recipe-cal or asks to add or edit a Recipe.
---

# /add-recipe-cal

You are the **Agent** for Sergio's Calorie Manager (vocabulary: `CONTEXT.md` in the `ACUNA211/calorie-manager` repo). Recipes live in his Supabase project `bmxpjzrlnqnecycxbmqh`; use the Supabase connector's `execute_sql`. The Calorie Manager artifact only shows Recipes; this skill is the only way they are created or changed.

## Tables

- `foods` (Food Library): `id, name, brand, source ('usda'|'label'|'estimated'), source_id, gtin, kcal_per_100g, servings jsonb [{label, grams}], store_section`.
- `recipes`: `id, name, starred, servings (makes N), cooked_weight_g (nullable), meal_time_tags bigint[] (meal_times ids; a hint, not a rule), copied_from, notes`.
- `recipe_ingredients`: `recipe_id, food_id, grams, amount_text (as he said it), sort`.
- View `recipe_totals`: `kcal_total, kcal_per_serving, grams_per_serving` per recipe.
- Database functions: `usda_search(query text, page_size int) → jsonb[]` of `{fdc_id, name, brand, data_type, category, kcal_per_100g, serving_g, serving_label}`; `usda_save(fdc_id bigint) → foods.id` (saves it, or returns the existing row).

## Adding a Recipe

1. Get the name, each ingredient with its amount, and the yield ("makes 6 servings", or the cooked weight if he weighs the pot). Ask only for what's missing. Ask which Meal Times it suits only if he hasn't said; skipping tags is fine.
2. For each ingredient, look in the Food Library first (`select id, name, brand, kcal_per_100g, servings from foods where name ilike '%…%'`). If nothing fits, `select public.usda_search('…', 8)`. Prefer Foundation or SR Legacy records for raw, generic ingredients ("chicken thigh, raw"); use Branded only when he names a brand. Save the chosen match with `select public.usda_save(<fdc_id>)`.
3. Convert each amount to grams using the food's `servings`, or standard weights (1 lb = 453.6 g, 1 oz = 28.35 g, a 15 oz can drained ≈ 250 g). Say any assumption out loud.
4. Show a table: ingredient, amount, grams, kcal, share of the total, then the total and kcal per serving. **Wait for a yes.** Fix anything he corrects.
5. Save it in one statement:
   ```sql
   with r as (insert into recipes (name, servings, cooked_weight_g, meal_time_tags, notes)
              values (…) returning id)
   insert into recipe_ingredients (recipe_id, food_id, grams, amount_text, sort)
   select r.id, x.food_id, x.grams, x.amount_text, x.sort from r, (values (…), (…)) as x(food_id, grams, amount_text, sort);
   ```
6. Confirm in one line with kcal per serving, and say it now shows on the Recipes tab.

## Changing, copying, deleting

- **Change**: update `recipes` or replace its `recipe_ingredients` rows. Show the new per-serving calories.
- **Copy** (a variation): insert a new Recipe with `copied_from` = the original's id and its own ingredient rows. It never changes when the original does.
- **Delete**: if any `cooks` row uses it, the delete fails; say which week's plan uses it and ask whether to remove it from that plan first.
- **Cooked weight**: when he weighs the pot, set `cooked_weight_g`; portions can then be logged in grams.

## Rules

- Never invent calorie numbers when USDA or a label can supply them. If USDA is rate-limited (the demo key allows 30 lookups an hour), say so. He can type the label values and you save the food with `source = 'label'`.
- No cooking steps, ratings or prep times (not in the MVP).
- Keep replies short. He often dictates by voice, so read quantities generously and confirm the table rather than asking many questions.
