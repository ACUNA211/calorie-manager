-- Calorie Manager: macros in the Food Library (ticket #13)
-- Run against a LOCAL stack only: `supabase start`, then `supabase test db`.
-- Checks NULL-not-zero for missing USDA nutrients, the per-serving totals in
-- recipe_totals (NULL-aware), and usda_save storing the macros and the calorie check.
-- usda_get is replaced inside this transaction with canned FoodData Central records, so
-- nothing calls USDA. The replacement is rolled back with the test.
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

-- One Household, so usda_save's private.current_household_id() resolves without a login
insert into public.households (name) values ('Macro test house');

-- Canned USDA responses (full /food/{id} shape) ------------------------------------
create or replace function public.usda_get(p_path text)
returns jsonb
language plpgsql as $$
begin
  if p_path = 'food/2' then
    -- kcal says 1000, but 4·20 + 4·50 + 9·10 = 370: the check replaces it
    return '{"fdcId":2,"description":"Stub bad kcal","dataType":"SR Legacy","foodNutrients":[
      {"nutrient":{"id":1008,"number":"208","unitName":"kcal"},"amount":1000},
      {"nutrient":{"id":1003,"number":"203","unitName":"g"},"amount":20},
      {"nutrient":{"id":1004,"number":"204","unitName":"g"},"amount":10},
      {"nutrient":{"id":1005,"number":"205","unitName":"g"},"amount":50}]}'::jsonb;
  elsif p_path = 'food/3' then
    -- only protein known: the check must not run, so kcal stays 1000
    return '{"fdcId":3,"description":"Stub partial macros","dataType":"SR Legacy","foodNutrients":[
      {"nutrient":{"id":1008,"number":"208","unitName":"kcal"},"amount":1000},
      {"nutrient":{"id":1003,"number":"203","unitName":"g"},"amount":20}]}'::jsonb;
  end if;
  -- food/1: all six macros present; fibre absent (must stay NULL)
  return '{"fdcId":1,"description":"Stub oats","dataType":"SR Legacy","foodNutrients":[
    {"nutrient":{"id":1008,"number":"208","unitName":"kcal"},"amount":370},
    {"nutrient":{"id":1003,"number":"203","unitName":"g"},"amount":20},
    {"nutrient":{"id":1004,"number":"204","unitName":"g"},"amount":10},
    {"nutrient":{"id":1005,"number":"205","unitName":"g"},"amount":50},
    {"nutrient":{"id":2000,"number":"269","unitName":"g"},"amount":3},
    {"nutrient":{"id":1093,"number":"307","unitName":"MG"},"amount":500}]}'::jsonb;
end $$;

-- 1-6. Nullable columns -------------------------------------------------------------
select col_is_null('foods', 'protein_g', 'foods.protein_g is nullable');
select col_is_null('foods', 'carbs_g', 'foods.carbs_g is nullable');
select col_is_null('foods', 'fat_g', 'foods.fat_g is nullable');
select col_is_null('foods', 'fibre_g', 'foods.fibre_g is nullable');
select col_is_null('foods', 'sugars_g', 'foods.sugars_g is nullable');
select col_is_null('foods', 'sodium_mg', 'foods.sodium_mg is nullable');

-- 7-14. usda_nutrient: NULL when absent, 0 when reported as 0 ----------------------
select is(
  public.usda_nutrient(
    '{"foodNutrients":[{"nutrient":{"id":1003,"number":"203","unitName":"g"},"amount":0}]}'::jsonb,
    array[1003], array['203'], 'G'),
  0::numeric,
  'a protein reported as 0 stays 0');

select is(
  public.usda_nutrient(
    '{"foodNutrients":[{"nutrient":{"id":1003,"number":"203","unitName":"g"},"amount":5}]}'::jsonb,
    array[1079], array['291'], 'G'),
  null::numeric,
  'a missing fibre is NULL, not 0');

select is(
  public.usda_nutrient(
    '{"foodNutrients":[{"nutrientId":1093,"nutrientNumber":"307","unitName":"MG","value":500}]}'::jsonb,
    array[1093], array['307'], 'MG'),
  500::numeric,
  'a search-hit sodium value is read');

select is(
  public.usda_nutrient(
    '{"foodNutrients":[{"nutrient":{"id":1093,"number":"307","unitName":"G"},"amount":0.5}]}'::jsonb,
    array[1093], array['307'], 'MG'),
  null::numeric,
  'a sodium reported in a different unit is NULL, never a wrong number');

select is(
  public.usda_nutrient(
    '{"foodNutrients":[{"nutrient":{"number":"203","unitName":"g"},"amount":12.5}]}'::jsonb,
    array[1003], array['203'], 'G'),
  12.5::numeric,
  'a nutrient found by number when its id is missing');

select is(
  public.usda_nutrient('{}'::jsonb, array[1003], array['203'], 'G'),
  null::numeric,
  'no foodNutrients gives NULL');

select is(
  public.usda_nutrient(
    '{"foodNutrients":[{"nutrient":{"id":2000,"number":"269","unitName":"g"},"amount":2},{"nutrient":{"id":1063,"number":"269","unitName":"g"},"amount":7}]}'::jsonb,
    array[2000], array['269'], 'G'),
  2::numeric,
  'a match by id wins over a match by number');

select is(
  public.usda_nutrient(
    '{"foodNutrients":[{"nutrient":{"id":1005,"number":"205","unitName":"g"},"amount":null}]}'::jsonb,
    array[1005], array['205'], 'G'),
  null::numeric,
  'a nutrient with no amount is NULL');

-- 15-17. Calorie sanity check -------------------------------------------------------
select is(public.atwater_kcal(10, 20, 5), 165::numeric, 'atwater: 4·10 + 4·20 + 9·5 = 165');
select is(public.atwater_kcal(null, null, null), null::numeric, 'atwater: no macros gives NULL');
select is(public.atwater_kcal(10, null, null), 40::numeric, 'atwater: a missing macro counts as nothing');

-- 18-19. A food with no macros keeps NULL; a food with fibre 0 keeps 0 ----------------
insert into public.foods (name, source, kcal_per_100g, household_id)
values ('Test no macros', 'estimated', 100, (select id from public.households where name = 'Macro test house'));
insert into public.foods (name, source, kcal_per_100g, fibre_g, household_id)
values ('Test zero fibre', 'estimated', 100, 0, (select id from public.households where name = 'Macro test house'));

select is((select protein_g from public.foods where name = 'Test no macros'), null::numeric, 'a food with no macros has NULL protein');
select is((select fibre_g from public.foods where name = 'Test zero fibre'), 0::numeric, 'a food with fibre 0 stores 0');

-- Recipes for the totals: A = oats (50 g), B = milk (200 g), no fibre in B ----------
insert into public.foods (name, source, kcal_per_100g, protein_g, carbs_g, fat_g, fibre_g, sugars_g, sodium_mg, household_id)
values ('Test oats', 'usda', 380, 13, 67, 7, 10, 1, 2, (select id from public.households where name = 'Macro test house')),
       ('Test milk', 'usda', 60, 3.2, 4.8, 3.3, null, 4.8, 44, (select id from public.households where name = 'Macro test house'));

insert into public.recipes (name, servings, household_id)
values ('Test oat bowl', 2, (select id from public.households where name = 'Macro test house')),
       ('Test empty', 1, (select id from public.households where name = 'Macro test house'));

insert into public.recipe_ingredients (recipe_id, food_id, grams, household_id)
select r.id, f.id, x.g, r.household_id
from (values ('Test oat bowl', 'Test oats', 50::numeric), ('Test oat bowl', 'Test milk', 200::numeric)) as x(rname, fname, g)
join public.recipes r on r.name = x.rname
join public.foods f on f.name = x.fname;

-- 20-29. recipe_totals ----------------------------------------------------------------
select is((select kcal_total from public.recipe_totals rt join public.recipes r on r.id = rt.recipe_id where r.name = 'Test oat bowl'),
          310::numeric, 'bowl kcal total: 50·3.8 + 200·0.6 = 310');
select is((select kcal_per_serving from public.recipe_totals rt join public.recipes r on r.id = rt.recipe_id where r.name = 'Test oat bowl'),
          155::numeric, 'bowl kcal per serving is 155');
select ok(abs((select protein_total from public.recipe_totals rt join public.recipes r on r.id = rt.recipe_id where r.name = 'Test oat bowl') - 12.9) < 0.0001,
          'bowl protein total is 12.9 g');
select ok(abs((select protein_per_serving from public.recipe_totals rt join public.recipes r on r.id = rt.recipe_id where r.name = 'Test oat bowl') - 6.45) < 0.0001,
          'bowl protein per serving is 6.45 g');
select ok(abs((select carbs_per_serving from public.recipe_totals rt join public.recipes r on r.id = rt.recipe_id where r.name = 'Test oat bowl') - 21.55) < 0.0001,
          'bowl carbs per serving is 21.55 g');
select ok(abs((select sugars_total from public.recipe_totals rt join public.recipes r on r.id = rt.recipe_id where r.name = 'Test oat bowl') - 10.1) < 0.0001,
          'bowl sugars total is 10.1 g');
select ok(abs((select sodium_mg_total from public.recipe_totals rt join public.recipes r on r.id = rt.recipe_id where r.name = 'Test oat bowl') - 89) < 0.0001,
          'bowl sodium total is 89 mg');
select is((select fibre_total from public.recipe_totals rt join public.recipes r on r.id = rt.recipe_id where r.name = 'Test oat bowl'),
          null::numeric, 'bowl fibre total is NULL: milk has no fibre value, so the total is unknown');
select is((select fibre_per_serving from public.recipe_totals rt join public.recipes r on r.id = rt.recipe_id where r.name = 'Test oat bowl'),
          null::numeric, 'bowl fibre per serving is NULL too');
select is((select protein_total from public.recipe_totals rt join public.recipes r on r.id = rt.recipe_id where r.name = 'Test empty'),
          0::numeric, 'a recipe with no ingredients totals 0 protein');

-- 30-38. usda_save: stores the six macros, NULL for the missing fibre -------------
select lives_ok('select public.usda_save(1)', 'usda_save saves a full USDA record');
select lives_ok('select public.usda_save(2)', 'usda_save saves a record whose kcal disagrees with its macros');
select lives_ok('select public.usda_save(3)', 'usda_save saves a record with only one macro');
select is((select protein_g from public.foods where source = 'usda' and source_id = '1'), 20::numeric,
          'usda_save stores protein from the record');
select is((select fibre_g from public.foods where source = 'usda' and source_id = '1'), null::numeric,
          'usda_save keeps fibre NULL when USDA does not report it');
select is((select sodium_mg from public.foods where source = 'usda' and source_id = '1'), 500::numeric,
          'usda_save stores sodium in mg');
select is((select kcal_per_100g from public.foods where source = 'usda' and source_id = '2'), 370::numeric,
          'usda_save replaces a kcal that disagrees with the macros (370, not 1000)');
select is((select kcal_per_100g from public.foods where source = 'usda' and source_id = '3'), 1000::numeric,
          'usda_save does not run the calorie check with only one macro known');
select ok((select macros_checked_at from public.foods where source = 'usda' and source_id = '1') is not null,
          'usda_save records when the macros were checked');

select * from finish();
rollback;
