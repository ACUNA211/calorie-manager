-- Calorie Manager: the Pantry is shared by one Household (ticket #25)
-- Run against a LOCAL stack only: `supabase start`, then `supabase test db`. Not run yet
-- (ticket #69).
-- Alice owns one Household and Carol is a second Member of it. Alice and Carol share one
-- Pantry. Bob owns another Household and must see and change none of Alice's Pantry.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

select set_config('test.alice', '11111111-1111-4111-8111-111111111111', true);
select set_config('test.bob', '22222222-2222-4222-8222-222222222222', true);
select set_config('test.carol', '33333333-3333-4333-8333-333333333333', true);

insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob@test.local'),
  (current_setting('test.carol')::uuid, 'authenticated', 'authenticated', 'carol@test.local');

-- Alice and Bob each create a Household and add one food to their Food Library
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Alice house', 'Alice'))::text, true);
insert into public.foods (name, source, kcal_per_100g) values ('Alice rice', 'estimated', 130);
select set_config('test.rice', (select id from public.foods where name = 'Alice rice')::text, true);

select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.bob_hh', (select public.create_household('Bob house', 'Bob'))::text, true);
insert into public.foods (name, source, kcal_per_100g) values ('Bob beans', 'estimated', 340);
select set_config('test.beans', (select id from public.foods where name = 'Bob beans')::text, true);
reset role;

-- Carol joins Alice's Household as a Member (joining goes through invites in the app)
insert into public.members (household_id, user_id, display_name, role)
  values (current_setting('test.alice_hh')::bigint, current_setting('test.carol')::uuid, 'Carol', 'member');

set local role authenticated;

-- Alice adds rice twice: one row, and the amounts add up
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select lives_ok($$ select public.pantry_add(current_setting('test.rice')::bigint, 100) $$, 'Alice adds 100 g of rice');
select lives_ok($$ select public.pantry_add(current_setting('test.rice')::bigint, 50) $$, 'Alice adds 50 g more rice');
select is((select count(*) from public.pantry_items where food_id = current_setting('test.rice')::bigint), 1::bigint, 'adding the same food twice keeps one row');
select is((select grams from public.pantry_items where food_id = current_setting('test.rice')::bigint), 150.0::numeric, 'the two amounts add up to 150 g');

-- Carol, another Member of the Household, sees and corrects the same item
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.carol'), 'role', 'authenticated')::text, true);
select is((select count(*) from public.pantry_items), 1::bigint, 'Carol sees the Household Pantry');
select is((select grams from public.pantry_items), 150.0::numeric, 'Carol sees the amount Alice added');
select is(public.pantry_correct((select id from public.pantry_items), 'half'), 75.0::numeric, 'Carol halves the item');

select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select is((select grams from public.pantry_items), 75.0::numeric, 'Alice sees the half that Carol made');
select is(public.pantry_correct((select id from public.pantry_items), 'used_up'), 0.0::numeric, 'used up sets the item to zero');
select lives_ok($$ select public.pantry_add(current_setting('test.rice')::bigint, 20) $$, 'adding to a used-up item is allowed');
select is((select grams from public.pantry_items), 20.0::numeric, 'a used-up item counts up again from zero');
select is((select count(*) from public.pantry_items), 1::bigint, 'still one row after used up and re-added');
select is(public.pantry_correct((select id from public.pantry_items), 'set', 33.3), 33.3::numeric, 'a typed amount replaces the old one');

-- Bad input is refused
select throws_ok($$ select public.pantry_correct((select id from public.pantry_items), 'set', -1) $$, '22023', null, 'a typed amount below zero is refused');
select throws_ok($$ select public.pantry_correct((select id from public.pantry_items), 'nonsense') $$, '22023', null, 'an unknown correction is refused');
select throws_ok($$ select public.pantry_add(current_setting('test.rice')::bigint, 0) $$, '22023', null, 'adding zero grams is refused');
select throws_ok($$ select public.pantry_add(999999, 10) $$, '42501', null, 'a food outside the Household is refused');
select throws_ok($$ insert into public.pantry_items (household_id, food_id, grams) values (current_setting('test.alice_hh')::bigint, current_setting('test.rice')::bigint, 5) $$, '42501', null, 'direct inserts into the Pantry are refused');

-- Bob's Household sees none of Alice's Pantry and cannot change it
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select is((select count(*) from public.pantry_items), 0::bigint, 'Bob sees no Pantry rows from another Household');
select throws_ok($$ select public.pantry_add(current_setting('test.rice')::bigint, 10) $$, '42501', null, 'Bob cannot add Alice''s food');
select throws_ok($$ select public.pantry_correct((select id from public.pantry_items), 'half') $$, '42501', null, 'Bob cannot correct Alice''s item');
select lives_ok($$ select public.pantry_add(current_setting('test.beans')::bigint, 40) $$, 'Bob adds his own beans');
select is((select count(*) from public.pantry_items), 1::bigint, 'Bob sees only his own Pantry row');

-- Alice still sees only her own row
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select is((select count(*) from public.pantry_items), 1::bigint, 'Alice sees only her Household rows after Bob adds his');

-- The unique key (one row per food per Household) holds even for a direct write
reset role;
select throws_ok($$ insert into public.pantry_items (household_id, food_id, grams) values (current_setting('test.alice_hh')::bigint, current_setting('test.rice')::bigint, 5) $$, '23505', null, 'a second row for the same food in one Household is refused');

select * from finish();
rollback;
