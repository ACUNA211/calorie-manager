-- Calorie Manager: macros in the Food Library (ticket #13)
-- Foods store protein, carbohydrate, fat, fibre, sugars and sodium per 100 g next to
-- kcal_per_100g. A missing value is NULL, never 0: USDA sometimes omits a nutrient, and
-- a 0 would claim a food has none of it.
--
-- USDA nutrient numbers and FoodData Central ids used here:
--   protein   203 / 1003  (g)        fat      204 / 1004  (g)
--   carbs     205 / 1005  (g)        fibre    291 / 1079  (g)
--   sugars    269 / 2000  (g)        sodium   307 / 1093  (mg)
-- A full /food/{id} record has nutrient: {id, number, unitName} and amount.
-- A search hit (foods/search) has nutrientId, nutrientNumber, unitName and value.
-- usda_nutrient reads both shapes.
--
-- Depends on 006 (household_id, usda_save with the Household) and 001 (recipe_totals).
-- Migration 008 belongs to another ticket. Nothing here calls USDA: the one-off backfill
-- (scripts/backfill-usda-macros.mjs) re-reads existing USDA foods and writes the
-- macros back with the service role.

-- 1. Columns (all nullable: NULL means USDA did not report it) --------------------
alter table public.foods
  add column protein_g numeric check (protein_g >= 0),
  add column carbs_g numeric check (carbs_g >= 0),
  add column fat_g numeric check (fat_g >= 0),
  add column fibre_g numeric check (fibre_g >= 0),
  add column sugars_g numeric check (sugars_g >= 0),
  add column sodium_mg numeric check (sodium_mg >= 0),
  -- when USDA was last asked for the macros (set by usda_save and the backfill), so a
  -- food USDA does not report at all is not re-fetched on every backfill run
  add column macros_checked_at timestamptz;

-- 2. One nutrient from a USDA food record or search hit -----------------------------
-- Returns NULL when USDA has no such nutrient, so the caller can keep NULL. A nutrient
-- USDA reports as 0 comes back as 0. Ids are preferred to numbers. A unit that is
-- present and different from p_unit gives NULL (never a wrong number).
create or replace function public.usda_nutrient(p_food jsonb, p_ids int[], p_numbers text[], p_unit text)
returns numeric
language sql immutable set search_path = public as $$
  select x.val
  from (
    select
      coalesce((n->>'amount')::numeric, (n->>'value')::numeric) as val,
      coalesce((n->>'nutrientId')::int, (n->'nutrient'->>'id')::int) as nid,
      coalesce(n->>'nutrientNumber', n->'nutrient'->>'number') as num,
      upper(coalesce(n->'nutrient'->>'unitName', n->>'unitName', p_unit)) as unit,
      ord
    from jsonb_array_elements(coalesce(p_food->'foodNutrients', '[]'::jsonb)) with ordinality as e(n, ord)
  ) x
  where x.val is not null
    and x.unit = upper(p_unit)
    and (x.nid = any (p_ids) or x.num = any (p_numbers))
  order by (case when x.nid = any (p_ids) then 0 else 1 end), x.ord
  limit 1
$$;

-- 3. The calorie sanity check (#01): 4·carb + 4·protein + 9·fat ----------------------
-- NULL when none of the three is known. A missing one counts as nothing here, but
-- usda_save only uses the check when all three are known (see usda_save).
create or replace function public.atwater_kcal(p_protein numeric, p_carbs numeric, p_fat numeric)
returns numeric
language sql immutable set search_path = public as $$
  select case when p_protein is null and p_carbs is null and p_fat is null then null
              else 4 * coalesce(p_protein, 0) + 4 * coalesce(p_carbs, 0) + 9 * coalesce(p_fat, 0) end
$$;

-- 4. usda_save: stores the six macros too (same signature, so grants are kept) ------
create or replace function public.usda_save(p_fdc_id bigint)
returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hh bigint;
  existing bigint;
  f jsonb;
  kcal numeric;
  v_protein numeric;
  v_carbs numeric;
  v_fat numeric;
  v_fibre numeric;
  v_sugars numeric;
  v_sodium numeric;
  computed numeric;
  servings jsonb := '[]';
  cat text;
  new_id bigint;
begin
  v_hh := private.current_household_id();

  select id into existing from public.foods
  where household_id = v_hh and source = 'usda' and source_id = p_fdc_id::text;
  if existing is not null then return existing; end if;

  f := public.usda_get('food/' || p_fdc_id);
  kcal := public.usda_kcal(f);

  v_protein := public.usda_nutrient(f, array[1003], array['203'], 'G');
  v_carbs   := public.usda_nutrient(f, array[1005], array['205'], 'G');
  v_fat     := public.usda_nutrient(f, array[1004], array['204'], 'G');
  v_fibre   := public.usda_nutrient(f, array[1079], array['291'], 'G');
  v_sugars  := public.usda_nutrient(f, array[2000], array['269'], 'G');
  v_sodium  := public.usda_nutrient(f, array[1093], array['307'], 'MG');

  -- sanity check (#01): label typos happen. The check needs all three of carb, protein
  -- and fat; with one missing, the 4·carb + 4·protein + 9·fat sum would be too low.
  computed := public.atwater_kcal(v_protein, v_carbs, v_fat);
  if kcal is null or (v_protein is not null and v_carbs is not null and v_fat is not null
                      and computed > 20 and abs(kcal - computed) / computed > 0.35) then
    kcal := computed;
  end if;
  if kcal is null then raise exception 'USDA food % has no calorie value', p_fdc_id; end if;

  if f->>'dataType' = 'Branded' then
    if upper(coalesce(f->>'servingSizeUnit','')) in ('G','GRM','ML','MLT') and (f->>'servingSize')::numeric > 0 then
      servings := jsonb_build_array(jsonb_build_object(
        'label', coalesce(nullif(f->>'householdServingFullText',''), '1 serving'),
        'grams', round((f->>'servingSize')::numeric, 1)));
    end if;
  else
    select coalesce(jsonb_agg(jsonb_build_object('label', lbl, 'grams', g)), '[]') into servings
    from (
      select distinct on (lbl) lbl, g from (
        select round((p->>'gramWeight')::numeric, 1) as g,
               trim(case when coalesce(p->>'portionDescription','') not in ('', 'Quantity not specified')
                         then p->>'portionDescription'
                         else coalesce(p->>'amount','1') || ' ' ||
                              coalesce(nullif(p->'measureUnit'->>'name', 'undetermined'), p->>'modifier', 'serving') end) as lbl
        from jsonb_array_elements(coalesce(f->'foodPortions', '[]')) p
        where (p->>'gramWeight')::numeric > 0
      ) s
    ) d;
  end if;

  cat := coalesce(f->>'brandedFoodCategory', f->'foodCategory'->>'description', f->>'foodCategory');

  insert into public.foods (name, brand, source, source_id, gtin, kcal_per_100g, servings, usda_category, store_section, household_id,
                            protein_g, carbs_g, fat_g, fibre_g, sugars_g, sodium_mg, macros_checked_at)
  values (f->>'description',
          coalesce(nullif(f->>'brandName',''), nullif(f->>'brandOwner','')),
          'usda', p_fdc_id::text, nullif(f->>'gtinUpc',''), round(kcal, 1), servings, cat, public.store_section_for(cat), v_hh,
          v_protein, v_carbs, v_fat, v_fibre, v_sugars, v_sodium, now())
  returning id into new_id;
  return new_id;
end $$;

-- 5. recipe_totals: calories and the six macros, total and per serving -------------
-- A macro total is NULL when any ingredient's food has no value for it: the recipe's
-- total is unknown, not a low number. A recipe with no ingredients totals 0.
-- Calories are unchanged (every food has kcal_per_100g). Same column names and order as
-- 001, so CREATE OR REPLACE applies; the new columns come after them.
create or replace view public.recipe_totals with (security_invoker = true) as
with t as (
  select r.id, r.servings, r.cooked_weight_g,
    coalesce(sum(ri.grams * f.kcal_per_100g / 100), 0) as kcal_total,
    case when count(ri.id) filter (where f.protein_g is null) = 0 then coalesce(sum(ri.grams * f.protein_g / 100), 0) end as protein_total,
    case when count(ri.id) filter (where f.carbs_g is null) = 0 then coalesce(sum(ri.grams * f.carbs_g / 100), 0) end as carbs_total,
    case when count(ri.id) filter (where f.fat_g is null) = 0 then coalesce(sum(ri.grams * f.fat_g / 100), 0) end as fat_total,
    case when count(ri.id) filter (where f.fibre_g is null) = 0 then coalesce(sum(ri.grams * f.fibre_g / 100), 0) end as fibre_total,
    case when count(ri.id) filter (where f.sugars_g is null) = 0 then coalesce(sum(ri.grams * f.sugars_g / 100), 0) end as sugars_total,
    case when count(ri.id) filter (where f.sodium_mg is null) = 0 then coalesce(sum(ri.grams * f.sodium_mg / 100), 0) end as sodium_mg_total
  from public.recipes r
  left join public.recipe_ingredients ri on ri.recipe_id = r.id
  left join public.foods f on f.id = ri.food_id
  group by r.id
)
select id as recipe_id,
       kcal_total,
       kcal_total / servings as kcal_per_serving,
       cooked_weight_g / servings as grams_per_serving,
       protein_total,
       protein_total / servings as protein_per_serving,
       carbs_total,
       carbs_total / servings as carbs_per_serving,
       fat_total,
       fat_total / servings as fat_per_serving,
       fibre_total,
       fibre_total / servings as fibre_per_serving,
       sugars_total,
       sugars_total / servings as sugars_per_serving,
       sodium_mg_total,
       sodium_mg_total / servings as sodium_mg_per_serving
from t;

-- 6. Grants: helpers are internal, like the other usda_* helpers ------------------
revoke all on function public.usda_nutrient(jsonb, int[], text[], text) from public, anon, authenticated;
revoke all on function public.atwater_kcal(numeric, numeric, numeric) from public, anon, authenticated;
