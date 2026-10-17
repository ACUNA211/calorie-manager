-- Calorie Manager: a food's package weight is set by its Household (ticket #26)
-- Run against a LOCAL stack only: `supabase start`, then `supabase test db`. Not run yet
-- (ticket #69).
-- Alice owns a Household and Carol is a second Member of it. Bob owns another Household.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select set_config('test.alice', '11111111-1111-4111-8111-111111111111', true);
select set_config('test.bob', '22222222-2222-4222-8222-222222222222', true);
select set_config('test.carol', '33333333-3333-4333-8333-333333333333', true);

insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob@test.local'),
  (current_setting('test.carol')::uuid, 'authenticated', 'authenticated', 'carol@test.local');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Alice house', 'Alice'))::text, true);
insert into public.foods (name, source, kcal_per_100g) values ('Alice soup', 'estimated', 60);
select set_config('test.soup', (select id from public.foods where name = 'Alice soup')::text, true);
reset role;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('test.bob_hh', (select public.create_household('Bob house', 'Bob'))::text, true);
reset role;

insert into public.members (household_id, user_id, display_name, role)
  values (current_setting('test.alice_hh')::bigint, current_setting('test.carol')::uuid, 'Carol', 'member');

set local role authenticated;

-- Alice sets the package weight; the value is stored and rounded to one decimal
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select is(public.set_package_grams(current_setting('test.soup')::bigint, 425.04), 425.0::numeric, 'Alice sets a package weight of 425 g');
select is((select package_grams from public.foods where id = current_setting('test.soup')::bigint), 425.0::numeric, 'the weight is stored on the food');

-- Carol, another Member of the Household, sees the weight
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.carol'), 'role', 'authenticated')::text, true);
select is((select package_grams from public.foods where id = current_setting('test.soup')::bigint), 425.0::numeric, 'Carol sees the weight Alice set');
select is(public.set_package_grams(current_setting('test.soup')::bigint, 400), 400.0::numeric, 'Carol may change it too');

-- Bad input is refused
select throws_ok($$ select public.set_package_grams(current_setting('test.soup')::bigint, 0) $$, '22023', null, 'a zero package weight is refused');
select throws_ok($$ select public.set_package_grams(current_setting('test.soup')::bigint, 100001) $$, '22023', null, 'a package weight above 100000 g is refused');

-- Bob cannot set a food outside his Household
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select throws_ok($$ select public.set_package_grams(current_setting('test.soup')::bigint, 300) $$, '42501', null, 'Bob cannot set the weight of Alice''s food');

select * from finish();
rollback;
