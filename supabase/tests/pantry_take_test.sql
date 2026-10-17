-- Calorie Manager: eating a Pantry food takes it off the Pantry (ticket #27)
-- Run against a LOCAL stack only: `supabase start`, then `supabase test db`. Not run yet
-- (ticket #69).
-- Alice owns a Household with rice in its Pantry. Bob owns another Household and must not
-- see or take any of Alice's Pantry.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select set_config('test.alice', '11111111-1111-4111-8111-111111111111', true);
select set_config('test.bob', '22222222-2222-4222-8222-222222222222', true);

insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob@test.local');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select public.create_household('Alice house', 'Alice');
insert into public.foods (name, source, kcal_per_100g) values ('Alice rice', 'estimated', 130);
select set_config('test.rice', (select id from public.foods where name = 'Alice rice')::text, true);
select public.pantry_add(current_setting('test.rice')::bigint, 150);

-- Eating 40 g takes 40 g off the Pantry and returns what was taken
select is(public.pantry_take(current_setting('test.rice')::bigint, 40), 40.0::numeric, 'eating 40 g takes 40 g');
select is((select grams from public.pantry_items), 110.0::numeric, 'the Pantry holds 110 g afterwards');

-- Eating more than is held takes only what is there, and never goes below zero
select is(public.pantry_take(current_setting('test.rice')::bigint, 500), 110.0::numeric, 'eating more than held takes what is held');
select is((select grams from public.pantry_items), 0.0::numeric, 'the Pantry is at zero, not below');

-- A food the Pantry does not hold is not an error: nothing is taken
select is(public.pantry_take(current_setting('test.rice')::bigint, 10), 0.0::numeric, 'eating from an empty item takes nothing');
select lives_ok($$ select public.pantry_take(999999, 10) $$, 'a food not in the Pantry does not fail');
select is(public.pantry_take(999999, 10), 0.0::numeric, 'a food not in the Pantry takes 0');

-- Bob cannot take Alice's rice
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select is(public.pantry_take(current_setting('test.rice')::bigint, 10), 0.0::numeric, 'another Household takes nothing from Alice');
select is((select count(*) from public.pantry_items), 0::bigint, 'another Household sees no Pantry rows');

select * from finish();
rollback;
