-- Calorie Manager: Spanish food names (ticket #16)
-- Run against a LOCAL stack only: `supabase start`, then `supabase test db`.
-- Checks that a Member's Spanish name is never overwritten by the translator, that the
-- translator's write path is service-role only, and that a failed translation keeps the
-- food with a NULL name_es. Everything is rolled back with the test.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into public.households (name) values ('Spanish names test house');

insert into public.foods (name, source, kcal_per_100g, household_id)
values
  ('Apples, raw', 'label', 52, (select id from public.households where name = 'Spanish names test house')),
  ('Pears, raw', 'label', 57, (select id from public.households where name = 'Spanish names test house')),
  ('Olive oil', 'label', 884, (select id from public.households where name = 'Spanish names test house'));

-- 1-3. Columns ---------------------------------------------------------------------
select col_is_null('foods', 'name_es', 'foods.name_es is nullable');
select col_not_null('foods', 'name_es_edited_by_member', 'foods.name_es_edited_by_member is not nullable');
select col_is_null('foods', 'name_es_attempted_at', 'foods.name_es_attempted_at is nullable');

-- 4. A new food has no Spanish name and no Member edit -----------------------------
select is((select name_es_edited_by_member from public.foods where name = 'Apples, raw'), false,
  'a food saved without a Spanish name is not marked as a Member edit');

-- 5. A Spanish name typed in on insert counts as the Member's ----------------------
insert into public.foods (name, source, kcal_per_100g, household_id, name_es)
values ('Bananas, raw', 'label', 89, (select id from public.households where name = 'Spanish names test house'), 'Plátano crudo');
select is((select name_es_edited_by_member from public.foods where name = 'Bananas, raw'), true,
  'a Spanish name supplied on insert is marked as a Member edit');

-- 6-8. The translator fills an unedited food ---------------------------------------
select ok(
  public.apply_food_spanish_name((select id from public.foods where name = 'Apples, raw'), '  Manzana cruda  '),
  'apply_food_spanish_name updates an unedited food');
select is((select name_es from public.foods where name = 'Apples, raw'), 'Manzana cruda',
  'the translated name is stored, trimmed');
select is((select name_es_edited_by_member from public.foods where name = 'Apples, raw'), false,
  'a translator write does not mark the food as a Member edit');

-- 9-10. The translator never overwrites a Member's name ----------------------------
select ok(
  not public.apply_food_spanish_name((select id from public.foods where name = 'Bananas, raw'), 'Banana cruda'),
  'apply_food_spanish_name refuses a food a Member named');
select is((select name_es from public.foods where name = 'Bananas, raw'), 'Plátano crudo',
  'the Member name survives a translator call');

-- 11-13. A Member edit on an unedited food is kept ----------------------------------
update public.foods set name_es = 'Manzana verde' where name = 'Apples, raw';
select is((select name_es_edited_by_member from public.foods where name = 'Apples, raw'), true,
  'a Member edit of name_es sets the flag');
select ok(
  not public.apply_food_spanish_name((select id from public.foods where name = 'Apples, raw'), 'Manzana'),
  'a later translator call does not overwrite the Member edit');
select is((select name_es from public.foods where name = 'Apples, raw'), 'Manzana verde',
  'the Member edit is still there');

-- 14. A plain update cannot clear the flag -----------------------------------------
update public.foods set name_es_edited_by_member = false where name = 'Apples, raw';
select is((select name_es_edited_by_member from public.foods where name = 'Apples, raw'), true,
  'the flag cannot be cleared by a plain update');

-- 15-16. Other columns do not mark the Spanish name --------------------------------
update public.foods set kcal_per_100g = 884.5 where name = 'Olive oil';
select is((select name_es_edited_by_member from public.foods where name = 'Olive oil'), false,
  'editing another column does not mark the Spanish name');
select is((select kcal_per_100g from public.foods where name = 'Olive oil'), 884.5::numeric,
  'the other column was updated');

-- 17-18. A failed translation keeps the food with no Spanish name ------------------
select ok(
  public.apply_food_spanish_name((select id from public.foods where name = 'Pears, raw'), null),
  'a failed translation (null name) is recorded and the food still exists');
select ok(
  (select name_es is null and name_es_attempted_at is not null from public.foods where name = 'Pears, raw'),
  'a failed translation leaves name_es NULL and records the attempt');

-- 19. A blank translation stores nothing -------------------------------------------
select ok(
  public.apply_food_spanish_name((select id from public.foods where name = 'Olive oil'), '   ')
    and (select name_es from public.foods where name = 'Olive oil') is null,
  'a blank translation stores nothing');

-- 20-21. Grants: only the service role can run the translator write ----------------
select ok(
  not has_function_privilege('authenticated', 'public.apply_food_spanish_name(bigint,text)', 'execute'),
  'authenticated cannot run apply_food_spanish_name');
select ok(
  not has_function_privilege('anon', 'public.apply_food_spanish_name(bigint,text)', 'execute'),
  'anon cannot run apply_food_spanish_name');

select * from finish();
rollback;
