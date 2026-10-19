-- Calorie Manager: Plan grid editing, migration 039 (ticket #40)
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`.
-- Alice (Owner) has Dana (adult) in her Household; Bob (Owner) has his own. Not run when written.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

select set_config('test.alice', '99999999-9999-4999-8999-999999999991', true);
select set_config('test.bob', '99999999-9999-4999-8999-999999999992', true);
select set_config('test.dana', '99999999-9999-4999-8999-999999999993', true);
insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice40@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob40@test.local'),
  (current_setting('test.dana')::uuid, 'authenticated', 'authenticated', 'dana40@test.local');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Alice house', 'Alice'))::text, true);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.bob_hh', (select public.create_household('Bob house', 'Bob'))::text, true);
reset role;

select set_config('test.alice_m', (select id::text from public.members where user_id = current_setting('test.alice')::uuid), true);
select set_config('test.bob_m', (select id::text from public.members where user_id = current_setting('test.bob')::uuid), true);
insert into public.members (household_id, user_id, display_name, role)
  values (current_setting('test.alice_hh')::bigint, current_setting('test.dana')::uuid, 'Dana', 'member');
select set_config('test.dana_m', (select id::text from public.members where user_id = current_setting('test.dana')::uuid), true);

-- A Recipe of 2 servings, a Meal Time shared by Alice and Dana, one only Alice has
insert into public.foods (name, kcal_per_100g, household_id)
  values ('Test rice 40', 100, current_setting('test.alice_hh')::bigint);
insert into public.recipes (name, servings, household_id)
  values ('Test stew 40', 2, current_setting('test.alice_hh')::bigint);
select set_config('test.recipe', (select id::text from public.recipes where name = 'Test stew 40'), true);

insert into public.meal_times (name, time_of_day, kind, member_id) values
  ('Family dinner 40', '18:30', 'planned', current_setting('test.alice_m')::bigint),
  ('Alice lunch 40', '12:30', 'planned', current_setting('test.alice_m')::bigint);
select set_config('test.mt', (select id::text from public.meal_times where name = 'Family dinner 40'), true);
select set_config('test.mt_alice', (select id::text from public.meal_times where name = 'Alice lunch 40'), true);
insert into public.meal_time_members (meal_time_id, member_id, cal_min, cal_max) values
  (current_setting('test.mt')::bigint, current_setting('test.alice_m')::bigint, 500, 700),
  (current_setting('test.mt')::bigint, current_setting('test.dana_m')::bigint, 400, 600),
  (current_setting('test.mt_alice')::bigint, current_setting('test.alice_m')::bigint, 300, 500);

-- Dana (not the Owner) adds a Cook to a week with no plan: the draft plan is made
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dana'), 'role', 'authenticated')::text, true);
select set_config('test.cook', public.plan_add_cook('2026-10-18', current_setting('test.recipe')::bigint, '2026-10-19')::text, true);
select is((select count(*)::int from public.meal_plans where week_start = '2026-10-18' and household_id = current_setting('test.alice_hh')::bigint), 1, 'adding a Cook makes the week''s plan');
select is((select servings_made from public.cooks where id = current_setting('test.cook')::bigint), 2::numeric, 'a new Cook makes the Recipe''s servings');

-- Dana places a Portion for Alice at the shared Meal Time, and one for herself
select lives_ok(format('select public.plan_set_portion(%s, %s, %s, %L, 1)', current_setting('test.cook'), current_setting('test.alice_m'), current_setting('test.mt'), '2026-10-20'), 'a Member places a Portion for another Member at a shared Meal Time');
select lives_ok(format('select public.plan_set_portion(%s, %s, %s, %L, 1.5)', current_setting('test.cook'), current_setting('test.dana_m'), current_setting('test.mt'), '2026-10-20'), 'and one for herself');
reset role;
select is((select servings_made from public.cooks where id = current_setting('test.cook')::bigint), 2.5::numeric, 'servings made grew to cover the Portions (1 + 1.5)');

-- Resizing the same slot updates it, with no second row
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dana'), 'role', 'authenticated')::text, true);
select lives_ok(format('select public.plan_set_portion(%s, %s, %s, %L, 0.75)', current_setting('test.cook'), current_setting('test.dana_m'), current_setting('test.mt'), '2026-10-20'), 'resizing a Portion works');
reset role;
select is((select count(*)::int from public.portions where cook_id = current_setting('test.cook')::bigint), 2, 'resizing did not add a row');
select is((select servings_made from public.cooks where id = current_setting('test.cook')::bigint), 2.5::numeric, 'servings made never shrinks');

-- A Member who does not share the Meal Time is refused
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dana'), 'role', 'authenticated')::text, true);
select throws_ok(format('select public.plan_set_portion(%s, %s, %s, %L, 1)', current_setting('test.cook'), current_setting('test.dana_m'), current_setting('test.mt_alice'), '2026-10-20'), '42501', null, 'a Portion needs a Member who shares the Meal Time');
select throws_ok(format('select public.plan_set_portion(%s, %s, %s, %L, 1)', current_setting('test.cook'), current_setting('test.alice_m'), current_setting('test.mt'), '2026-10-25'), '22023', null, 'the day must be inside the week');
select throws_ok(format('select public.plan_set_portion(%s, %s, %s, %L, 0)', current_setting('test.cook'), current_setting('test.alice_m'), current_setting('test.mt'), '2026-10-20'), '22023', null, 'servings must be above zero');

-- Move: Alice's Portion goes to her lunch and another day
select lives_ok(format('select public.plan_move_portion((select id from public.portions where member_id = %s), %s, %L)', current_setting('test.alice_m'), current_setting('test.mt_alice'), '2026-10-21'), 'a Portion can be moved');
reset role;
select is((select eat_date from public.portions where member_id = current_setting('test.alice_m')::bigint), '2026-10-21'::date, 'the Portion is on its new day');

-- A logged Portion cannot be moved or removed
insert into public.calorie_log (member_id, log_date, portion_id, description, kcal)
  select p.member_id, p.eat_date, p.id, 'logged', 100 from public.portions p where p.member_id = current_setting('test.dana_m')::bigint;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dana'), 'role', 'authenticated')::text, true);
select throws_ok(format('select public.plan_remove_portion((select id from public.portions where member_id = %s))', current_setting('test.dana_m')), '22023', null, 'a logged Portion cannot be removed');
select throws_ok(format('select public.plan_delete_cook(%s)', current_setting('test.cook')), '22023', null, 'a Cook with a logged Portion cannot be deleted');
-- Remove Alice's (not logged) Portion
select lives_ok(format('select public.plan_remove_portion((select id from public.portions where member_id = %s))', current_setting('test.alice_m')), 'a Portion can be removed');
reset role;
select is((select count(*)::int from public.portions where cook_id = current_setting('test.cook')::bigint), 1, 'one Portion is left');

-- Bob (another Household) can change nothing of Alice's
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select throws_ok(format('select public.plan_delete_cook(%s)', current_setting('test.cook')), '42501', null, 'another Household cannot delete the Cook');
select throws_ok(format('select public.plan_add_cook(%L, %s, %L)', '2026-10-18', current_setting('test.recipe'), '2026-10-19'), '42501', null, 'another Household cannot use the Recipe');
reset role;

-- Editing an approved plan marks it changed since approval; approving again clears it
update public.meal_plans set status = 'approved', approved_at = now() where week_start = '2026-10-18' and household_id = current_setting('test.alice_hh')::bigint;
select is((select changed_since_approval from public.meal_plans where week_start = '2026-10-18' and household_id = current_setting('test.alice_hh')::bigint), false, 'a freshly approved plan is not marked changed');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select lives_ok(format('select public.plan_set_portion(%s, %s, %s, %L, 1)', current_setting('test.cook'), current_setting('test.alice_m'), current_setting('test.mt'), '2026-10-22'), 'editing an approved plan is allowed');
select is((public.plan_week('2026-10-18') -> 'plan' ->> 'changed_since_approval')::boolean, true, 'it is marked changed since approval');
reset role;
update public.meal_plans set status = 'draft' where week_start = '2026-10-18' and household_id = current_setting('test.alice_hh')::bigint;
select is((select changed_since_approval from public.meal_plans where week_start = '2026-10-18' and household_id = current_setting('test.alice_hh')::bigint), false, 'a status change clears the mark');

set local role anon;
select throws_ok(format('select public.plan_delete_cook(%s)', current_setting('test.cook')), '42501', null, 'anon cannot call the write functions');
reset role;

select * from finish();
rollback;
