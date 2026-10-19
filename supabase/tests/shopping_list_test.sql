-- Calorie Manager: Shopping list from approve, migration 044 (ticket #46)
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`. Not run when written.
-- Alice (Owner) has Dana (Member) in her Household; Bob (Owner) has his own.
-- Stew (2 servings) needs rice 400 g, beans 300 g, apple 150 g; the Pantry holds rice 1000 g, beans 100 g, no apple.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

select set_config('test.alice', '99999999-9999-4999-8999-999999999961', true);
select set_config('test.bob', '99999999-9999-4999-8999-999999999962', true);
select set_config('test.dana', '99999999-9999-4999-8999-999999999963', true);
insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice46@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob46@test.local'),
  (current_setting('test.dana')::uuid, 'authenticated', 'authenticated', 'dana46@test.local');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Alice house', 'Alice'))::text, true);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.bob_hh', (select public.create_household('Bob house', 'Bob'))::text, true);
reset role;
insert into public.members (household_id, user_id, display_name, role)
  values (current_setting('test.alice_hh')::bigint, current_setting('test.dana')::uuid, 'Dana', 'member');

-- Foods: rice (package 1000 g), beans (a 425 g can), apple (no serving data)
insert into public.foods (name, source, kcal_per_100g, store_section, servings, package_grams, household_id) values
  ('Rice 46', 'label', 365, 'Canned & dry goods', '[]', 1000, current_setting('test.alice_hh')::bigint),
  ('Beans 46', 'label', 90, 'Canned & dry goods', '[{"label":"1 can","grams":425}]', null, current_setting('test.alice_hh')::bigint),
  ('Apple 46', 'label', 52, 'Produce', '[]', null, current_setting('test.alice_hh')::bigint);
select set_config('test.rice', (select id::text from public.foods where name = 'Rice 46'), true);
select set_config('test.beans', (select id::text from public.foods where name = 'Beans 46'), true);
select set_config('test.apple', (select id::text from public.foods where name = 'Apple 46'), true);

insert into public.recipes (name, servings, household_id) values ('Stew 46', 2, current_setting('test.alice_hh')::bigint);
select set_config('test.recipe', (select id::text from public.recipes where name = 'Stew 46'), true);
insert into public.recipe_ingredients (recipe_id, food_id, grams, household_id) values
  (current_setting('test.recipe')::bigint, current_setting('test.rice')::bigint, 400, current_setting('test.alice_hh')::bigint),
  (current_setting('test.recipe')::bigint, current_setting('test.beans')::bigint, 300, current_setting('test.alice_hh')::bigint),
  (current_setting('test.recipe')::bigint, current_setting('test.apple')::bigint, 150, current_setting('test.alice_hh')::bigint);

insert into public.pantry_items (household_id, food_id, grams) values
  (current_setting('test.alice_hh')::bigint, current_setting('test.rice')::bigint, 1000),
  (current_setting('test.alice_hh')::bigint, current_setting('test.beans')::bigint, 100);

insert into public.meal_plans (household_id, week_start) values (current_setting('test.alice_hh')::bigint, '2026-10-18');
select set_config('test.plan', (select id::text from public.meal_plans where household_id = current_setting('test.alice_hh')::bigint), true);
insert into public.cooks (meal_plan_id, recipe_id, cook_date, servings_made, household_id)
  values (current_setting('test.plan')::bigint, current_setting('test.recipe')::bigint, '2026-10-20', 2, current_setting('test.alice_hh')::bigint);

-- A draft plan builds no list
select is((select count(*)::int from public.grocery_list where meal_plan_id = current_setting('test.plan')::bigint), 0, 'a draft plan adds no lines');

-- Approve
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select is((public.plan_approve(current_setting('test.plan')::bigint) ->> 'shopping_lines_added')::int, 2, 'approving adds two lines (rice is covered by the Pantry)');
reset role;

select is((select count(*)::int from public.grocery_list where meal_plan_id = current_setting('test.plan')::bigint and food_id = current_setting('test.rice')::bigint), 0, 'no line for a food the Pantry fully covers');
select is((select need_grams from public.grocery_list where food_id = current_setting('test.beans')::bigint), 200::numeric, 'beans: need 300 minus Pantry 100 = 200 g');
select is((select measure_kind || ':' || measure_count || ':' || grams from public.grocery_list where food_id = current_setting('test.beans')::bigint), 'serving:1:425', 'beans in one shopping measure: 1 can of 425 g');
select is((select measure_kind || ':' || grams from public.grocery_list where food_id = current_setting('test.apple')::bigint), 'weight:150', 'apple with no serving data: grams in steps of 50');
select is((select source from public.grocery_list where food_id = current_setting('test.apple')::bigint), 'plan', 'first lines are source plan');
select is((select store_section from public.grocery_list where food_id = current_setting('test.apple')::bigint), 'Produce', 'a line carries its store section');
select ok((select (select id from public.grocery_list where food_id = current_setting('test.apple')::bigint) < (select id from public.grocery_list where food_id = current_setting('test.beans')::bigint)), 'lines are added in store-section order (Produce before Canned & dry goods)');
select is((select created_at::date from public.grocery_list where food_id = current_setting('test.beans')::bigint), current_date, 'a line has its added date');

-- Every Member sees the same list; another Household sees none of it
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dana'), 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.grocery_list where meal_plan_id = current_setting('test.plan')::bigint), 2, 'a second Member sees the same two lines');
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.grocery_list where meal_plan_id = current_setting('test.plan')::bigint), 0, 'another Household sees none');
select is((select count(*)::int from public.shopping_cover), 0, 'another Household cannot read the cover rows');
reset role;

-- Syncing again adds nothing
select is(public.sync_shopping_list(current_setting('test.plan')::bigint), 0, 'syncing again adds no lines');

-- Plan grows after approval: servings 2 -> 4 doubles the need.
-- Rice need 800 g: still within the 1000 g Pantry, so still no line.
-- Beans need 600 g: 100 counted from the Pantry, 200 on the first line, 300 new -> 1 can more.
-- Apple need 300 g: 150 g more -> a new line; the first line is untouched.
create temp table t46_before as
  select id, grams, quantity_needed, created_at from public.grocery_list where meal_plan_id = current_setting('test.plan')::bigint;
update public.cooks set servings_made = 4 where meal_plan_id = current_setting('test.plan')::bigint;

select is((select count(*)::int from public.grocery_list where meal_plan_id = current_setting('test.plan')::bigint), 4, 'growing the plan adds a line for each extra need');
select is((select count(*)::int from public.grocery_list where food_id = current_setting('test.rice')::bigint), 0, 'extra rice need still covered by the spare Pantry');
select is((select count(*)::int from public.grocery_list where source = 'plan_extra' and food_id in (current_setting('test.beans')::bigint, current_setting('test.apple')::bigint)), 2, 'new lines are marked plan_extra');
select is((select count(*)::int from public.grocery_list g join t46_before b using (id) where g.grams = b.grams and g.quantity_needed = b.quantity_needed and g.created_at = b.created_at), 2, 'existing lines are not rewritten');

-- Shrinking the plan removes nothing
update public.cooks set servings_made = 1 where meal_plan_id = current_setting('test.plan')::bigint;
select is((select count(*)::int from public.grocery_list where meal_plan_id = current_setting('test.plan')::bigint), 4, 'shrinking the plan removes no lines');

-- A plan that is not approved gets nothing
insert into public.meal_plans (household_id, week_start) values (current_setting('test.alice_hh')::bigint, '2026-10-25');
select is(public.sync_shopping_list((select id from public.meal_plans where week_start = '2026-10-25' and household_id = current_setting('test.alice_hh')::bigint)), 0, 'a draft plan adds nothing even when synced directly');

select * from finish();
rollback;
