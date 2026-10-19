-- Calorie Manager: plan_validation_data() (ticket #41)
-- Run against a LOCAL stack only. Not run when written (no local stack).
-- Alice (Owner) and Dana share a Meal Time with different ranges; Dana is vegetarian and the
-- Cook's Recipe has chicken. Bob has his own Household.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select set_config('test.alice', '41414141-4141-4141-8141-414141414141', true);
select set_config('test.bob', '41414141-4141-4141-8141-414141414142', true);
select set_config('test.dana', '41414141-4141-4141-8141-414141414143', true);
insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice41@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob41@test.local'),
  (current_setting('test.dana')::uuid, 'authenticated', 'authenticated', 'dana41@test.local');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Alice house 41', 'Alice'))::text, true);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select public.create_household('Bob house 41', 'Bob');
reset role;

select set_config('test.alice_m', (select id::text from public.members where user_id = current_setting('test.alice')::uuid), true);
insert into public.members (household_id, user_id, display_name, role)
  values (current_setting('test.alice_hh')::bigint, current_setting('test.dana')::uuid, 'Dana', 'member');
select set_config('test.dana_m', (select id::text from public.members where user_id = current_setting('test.dana')::uuid), true);

insert into public.foods (name, kcal_per_100g, household_id)
  values ('Chicken breast 41', 165, current_setting('test.alice_hh')::bigint);
insert into public.recipes (name, servings, household_id)
  values ('Chicken pot 41', 2, current_setting('test.alice_hh')::bigint);
insert into public.recipe_ingredients (recipe_id, food_id, grams)
  select r.id, f.id, 400 from public.recipes r, public.foods f
   where r.name = 'Chicken pot 41' and f.name = 'Chicken breast 41';

insert into public.meal_times (name, time_of_day, kind, member_id)
  values ('Family dinner 41', '18:30', 'planned', current_setting('test.alice_m')::bigint);
select set_config('test.mt', (select id::text from public.meal_times where name = 'Family dinner 41'), true);
insert into public.meal_time_members (meal_time_id, member_id, cal_min, cal_max) values
  (current_setting('test.mt')::bigint, current_setting('test.alice_m')::bigint, 500, 700),
  (current_setting('test.mt')::bigint, current_setting('test.dana_m')::bigint, 400, 600);

insert into public.meal_plans (week_start, household_id)
  values ('2026-10-18', current_setting('test.alice_hh')::bigint);
insert into public.cooks (meal_plan_id, recipe_id, cook_date, servings_made, household_id)
  select mp.id, r.id, '2026-10-19', 2, mp.household_id
    from public.meal_plans mp, public.recipes r
   where r.name = 'Chicken pot 41' and mp.week_start = '2026-10-18';
insert into public.portions (cook_id, meal_time_id, eat_date, servings, member_id)
  select c.id, current_setting('test.mt')::bigint, '2026-10-19', 1, m
    from public.cooks c,
         unnest(array[current_setting('test.alice_m')::bigint, current_setting('test.dana_m')::bigint]) m;
insert into public.member_preferences (member_id, hard_diets)
  values (current_setting('test.dana_m')::bigint, array['vegetarian'])
  on conflict (member_id) do update set hard_diets = array['vegetarian'];

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.a', public.plan_validation_data('2026-10-18')::text, true);
select set_config('test.a_empty', public.plan_validation_data('2026-10-25')::text, true);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.b', public.plan_validation_data('2026-10-18')::text, true);
reset role;
set local role anon;
select throws_ok($$select public.plan_validation_data('2026-10-18')$$, '42501', null, 'anon cannot call it');
reset role;

select is(jsonb_array_length(current_setting('test.a')::jsonb -> 'ranges'), 2, 'both sharers'' ranges come back');
select is((select r ->> 'cal_max' from jsonb_array_elements(current_setting('test.a')::jsonb -> 'ranges') r
            where (r ->> 'member_id')::bigint = current_setting('test.dana_m')::bigint), '600', 'Dana''s own range, not Alice''s');
select is((current_setting('test.a')::jsonb -> 'breaks' -> 0 ->> 'member_id')::bigint, current_setting('test.dana_m')::bigint, 'the break is Dana''s (vegetarian)');
select is(jsonb_array_length(current_setting('test.a')::jsonb -> 'recipe_ids'), 1, 'the plan''s Recipe exists');
select is(jsonb_array_length(current_setting('test.a_empty')::jsonb -> 'ranges'), 0, 'a week with no plan has nothing');
-- (Bob's call returns an empty object-set because his Household has no plan that week)

select * from finish();
rollback;
