-- Calorie Manager: plan_week() (ticket #39)
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`.
-- Alice (Owner) has Dana (adult) in her Household; Bob (Owner) has his own. A Cook for Alice's
-- week has one Portion each for Alice and Dana at a shared Meal Time. Not run when written.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select set_config('test.alice', '88888888-8888-4888-8888-888888888881', true);
select set_config('test.bob', '88888888-8888-4888-8888-888888888882', true);
select set_config('test.dana', '88888888-8888-4888-8888-888888888883', true);
insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice39@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob39@test.local'),
  (current_setting('test.dana')::uuid, 'authenticated', 'authenticated', 'dana39@test.local');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Alice house', 'Alice'))::text, true);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.bob_hh', (select public.create_household('Bob house', 'Bob'))::text, true);
reset role;

select set_config('test.alice_m', (select id::text from public.members where user_id = current_setting('test.alice')::uuid), true);
insert into public.members (household_id, user_id, display_name, role)
  values (current_setting('test.alice_hh')::bigint, current_setting('test.dana')::uuid, 'Dana', 'member');
select set_config('test.dana_m', (select id::text from public.members where user_id = current_setting('test.dana')::uuid), true);

insert into public.member_settings (member_id, calorie_target, band_low_pct, band_high_pct)
  values (current_setting('test.alice_m')::bigint, 2000, 90, 100)
  on conflict (member_id) do update
    set calorie_target = 2000, band_low_pct = 90, band_high_pct = 100;

-- A Recipe (400 kcal a serving), a shared Meal Time, a plan, a Cook and two Portions
insert into public.foods (name, kcal_per_100g, household_id)
  values ('Test rice 39', 100, current_setting('test.alice_hh')::bigint);
insert into public.recipes (name, servings, household_id)
  values ('Test stew 39', 2, current_setting('test.alice_hh')::bigint);
insert into public.recipe_ingredients (recipe_id, food_id, grams)
  select r.id, f.id, 800 from public.recipes r, public.foods f
   where r.name = 'Test stew 39' and f.name = 'Test rice 39';

insert into public.meal_times (name, time_of_day, kind, member_id)
  values ('Family dinner', '18:30', 'planned', current_setting('test.alice_m')::bigint);
select set_config('test.mt', (select id::text from public.meal_times where name = 'Family dinner'), true);
insert into public.meal_time_members (meal_time_id, member_id, cal_min, cal_max) values
  (current_setting('test.mt')::bigint, current_setting('test.alice_m')::bigint, 500, 700),
  (current_setting('test.mt')::bigint, current_setting('test.dana_m')::bigint, 400, 600);

insert into public.meal_plans (week_start, household_id)
  values ('2026-10-18', current_setting('test.alice_hh')::bigint);
insert into public.cooks (meal_plan_id, recipe_id, cook_date, servings_made, household_id)
  select mp.id, r.id, '2026-10-19', 2, mp.household_id
    from public.meal_plans mp, public.recipes r
   where r.name = 'Test stew 39' and mp.week_start = '2026-10-18';
insert into public.portions (cook_id, meal_time_id, eat_date, servings, member_id)
  select c.id, current_setting('test.mt')::bigint, '2026-10-19', 1, m
    from public.cooks c,
         unnest(array[current_setting('test.alice_m')::bigint, current_setting('test.dana_m')::bigint]) m;

-- Dana (a plain adult) reads the whole Household plan, including Alice's Portion
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dana'), 'role', 'authenticated')::text, true);
select set_config('test.d_plan', public.plan_week('2026-10-18')::text, true);
select set_config('test.d_empty', public.plan_week('2026-10-25')::text, true);
reset role;

-- Bob reads the same week and sees nothing of Alice's
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.b_plan', public.plan_week('2026-10-18')::text, true);
reset role;

-- A Monday is refused; an anonymous caller cannot call it
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dana'), 'role', 'authenticated')::text, true);
select throws_ok($$select public.plan_week('2026-10-19')$$, '22023', null, 'a week must start on a Sunday');
reset role;
set local role anon;
select throws_ok($$select public.plan_week('2026-10-18')$$, '42501', null, 'anon cannot call plan_week');
reset role;

select is(current_setting('test.d_plan')::jsonb -> 'plan' ->> 'status', 'draft', 'Dana sees the plan');
select is(jsonb_array_length(current_setting('test.d_plan')::jsonb -> 'cooks'), 1, 'one Cook');
select is((current_setting('test.d_plan')::jsonb -> 'cooks' -> 0 ->> 'kcal_per_serving')::numeric, 400::numeric, 'the Cook carries the Recipe calories per serving');
select is(jsonb_array_length(current_setting('test.d_plan')::jsonb -> 'portions'), 2, 'Dana sees both Members'' Portions');
select is(jsonb_array_length(current_setting('test.d_plan')::jsonb -> 'meal_times' -> 0 -> 'member_ids'), 2, 'the shared Meal Time lists both sharers');
select is((select m ->> 'band_low' from jsonb_array_elements(current_setting('test.d_plan')::jsonb -> 'members') m where m ->> 'display_name' = 'Alice'), '1800', 'Alice''s band low is 90% of 2000');
select ok(current_setting('test.d_empty')::jsonb -> 'plan' = 'null'::jsonb, 'a week with no plan has plan null');
select is(jsonb_array_length(current_setting('test.b_plan')::jsonb -> 'cooks'), 0, 'Bob sees none of Alice''s Cooks');
select is(jsonb_array_length(current_setting('test.b_plan')::jsonb -> 'members'), 1, 'Bob sees only his own Household''s Members');

select * from finish();
rollback;
