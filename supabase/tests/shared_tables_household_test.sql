-- Calorie Manager: shared tables are per Household (ticket #08)
-- Run against a LOCAL stack only: `supabase start`, then `supabase test db`.
-- Two Households (Alice's and Bob's), each made by its Owner through create_household.
-- Each person adds rows as themselves, so household_id comes from the column default.
-- Assertions run as the database owner, reading back settings written as each person.
-- Needs the grocery_list base table (defined outside these migrations) to exist, and
-- accepts item_name as its only required column.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

select set_config('test.alice', '11111111-1111-4111-8111-111111111111', true);
select set_config('test.bob', '22222222-2222-4222-8222-222222222222', true);

insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob@test.local');

-- Each Owner creates a Household
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Alice house', 'Alice'))::text, true);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.bob_hh', (select public.create_household('Bob house', 'Bob'))::text, true);
reset role;

-- Alice adds one row to each shared table (household_id from the default)
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
insert into public.foods (name, source, kcal_per_100g) values ('Alice rice', 'estimated', 130);
insert into public.recipes (name) values ('Alice bowl');
insert into public.recipe_ingredients (recipe_id, food_id, grams)
  values ((select id from public.recipes where name = 'Alice bowl'),
          (select id from public.foods where name = 'Alice rice'), 100);
insert into public.meal_plans (week_start) values ('2026-10-18');
insert into public.cooks (meal_plan_id, recipe_id, cook_date, servings_made)
  values ((select id from public.meal_plans where week_start = '2026-10-18'),
          (select id from public.recipes where name = 'Alice bowl'), '2026-10-18', 2);
insert into public.grocery_list (item_name) values ('Alice milk');
reset role;

-- Bob adds one row to each shared table
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
insert into public.foods (name, source, kcal_per_100g) values ('Bob beans', 'estimated', 340);
insert into public.recipes (name) values ('Bob bowl');
insert into public.recipe_ingredients (recipe_id, food_id, grams)
  values ((select id from public.recipes where name = 'Bob bowl'),
          (select id from public.foods where name = 'Bob beans'), 150);
insert into public.meal_plans (week_start) values ('2026-10-18');
insert into public.cooks (meal_plan_id, recipe_id, cook_date, servings_made)
  values ((select id from public.meal_plans where week_start = '2026-10-18'),
          (select id from public.recipes where name = 'Bob bowl'), '2026-10-18', 3);
insert into public.grocery_list (item_name) values ('Bob eggs');
reset role;

-- What Alice can see in each shared table (she should see only her own row each time)
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.a_seen', (select json_build_object(
  'foods', (select count(*) from public.foods),
  'recipes', (select count(*) from public.recipes),
  'recipe_ingredients', (select count(*) from public.recipe_ingredients),
  'meal_plans', (select count(*) from public.meal_plans),
  'cooks', (select count(*) from public.cooks),
  'grocery_list', (select count(*) from public.grocery_list)
)::text), true);

-- Alice tries to write Bob's rows; RLS blocks inserts (error) and hides updates and deletes (0 rows)
do $$
begin
  insert into public.foods (name, source, kcal_per_100g, household_id)
    values ('Sneaky food', 'estimated', 1, current_setting('test.bob_hh')::bigint);
  perform set_config('test.a_insert', 'ok', true);
exception when others then
  perform set_config('test.a_insert', sqlstate, true);
end $$;
do $$
declare n int := -1;
begin
  update public.recipes set name = 'Hacked' where name = 'Bob bowl';
  get diagnostics n = row_count;
  perform set_config('test.a_update', n::text, true);
end $$;
do $$
declare n int := -1;
begin
  delete from public.meal_plans
  where household_id = current_setting('test.bob_hh')::bigint;
  get diagnostics n = row_count;
  perform set_config('test.a_delete', n::text, true);
end $$;
reset role;

-- What Bob can see in each shared table
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.b_seen', (select json_build_object(
  'foods', (select count(*) from public.foods),
  'recipes', (select count(*) from public.recipes),
  'recipe_ingredients', (select count(*) from public.recipe_ingredients),
  'meal_plans', (select count(*) from public.meal_plans),
  'cooks', (select count(*) from public.cooks),
  'grocery_list', (select count(*) from public.grocery_list)
)::text), true);
reset role;

-- Constraints and per-Household uniqueness (database owner)
select throws_ok(
  $$insert into public.foods (name, source, kcal_per_100g, household_id)
    values ('No house', 'estimated', 1, null)$$,
  '23502',
  null,
  'a shared row must belong to a Household'
);
select lives_ok(
  $$insert into public.foods (name, source, source_id, kcal_per_100g, household_id)
    values ('Rice (USDA)', 'usda', '4242', 130, (select household_id from public.foods where name = 'Alice rice'))$$,
  'Alice can save a USDA food'
);
select lives_ok(
  $$insert into public.foods (name, source, source_id, kcal_per_100g, household_id)
    values ('Rice (USDA)', 'usda', '4242', 130, (select household_id from public.foods where name = 'Bob beans'))$$,
  'Bob can save the same USDA food into his own Household'
);
select throws_ok(
  $$insert into public.foods (name, source, source_id, kcal_per_100g, household_id)
    values ('Rice (USDA) again', 'usda', '4242', 130, (select household_id from public.foods where name = 'Alice rice'))$$,
  '23505',
  null,
  'a Household cannot hold the same USDA food twice'
);

-- Assertions
select is(current_setting('test.a_seen')::json->>'foods', '1', 'Alice sees only her own food');
select is(current_setting('test.a_seen')::json->>'recipes', '1', 'Alice sees only her own recipe');
select is(current_setting('test.a_seen')::json->>'recipe_ingredients', '1', 'Alice sees only her own recipe ingredient');
select is(current_setting('test.a_seen')::json->>'meal_plans', '1', 'Alice sees only her own Meal Plan');
select is(current_setting('test.a_seen')::json->>'cooks', '1', 'Alice sees only her own Cook');
select is(current_setting('test.a_seen')::json->>'grocery_list', '1', 'Alice sees only her own Shopping list rows');
select is(current_setting('test.b_seen')::json->>'foods', '1', 'Bob sees only his own food');
select is(current_setting('test.b_seen')::json->>'recipes', '1', 'Bob sees only his own recipe');
select is(current_setting('test.b_seen')::json->>'recipe_ingredients', '1', 'Bob sees only his own recipe ingredient');
select is(current_setting('test.b_seen')::json->>'meal_plans', '1', 'Bob sees only his own Meal Plan');
select is(current_setting('test.b_seen')::json->>'cooks', '1', 'Bob sees only his own Cook');
select is(current_setting('test.b_seen')::json->>'grocery_list', '1', 'Bob sees only his own Shopping list rows');
select is(current_setting('test.a_insert'), '42501', 'Alice cannot add a food to Bob''s Household');
select is(current_setting('test.a_update'), '0', 'Alice cannot rename Bob''s recipe');
select is(current_setting('test.a_delete'), '0', 'Alice cannot delete Bob''s Meal Plan');
select is(
  (select name from public.recipes where household_id = current_setting('test.bob_hh')::bigint),
  'Bob bowl',
  'Bob''s recipe keeps its name after Alice''s attempt'
);
select is(
  (select household_id::text from public.foods where name = 'Alice rice'),
  current_setting('test.alice_hh'),
  'a row written by Alice takes Alice''s Household from the default'
);
select is(
  (select count(*)::text from public.meal_plans where week_start = '2026-10-18'),
  '2',
  'both Households can plan the same week'
);

select * from finish();
rollback;
