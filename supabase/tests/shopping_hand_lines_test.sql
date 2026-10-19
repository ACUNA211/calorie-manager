-- Calorie Manager: hand-added lines and offline ticking, migration 047 (ticket #48)
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`. Not run when written.
-- Alice (Owner) has Dana (Member); Bob (Owner) has his own Household.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

select set_config('test.alice', '99999999-9999-4999-8999-999999999981', true);
select set_config('test.bob', '99999999-9999-4999-8999-999999999982', true);
select set_config('test.dana', '99999999-9999-4999-8999-999999999983', true);
insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice48@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob48@test.local'),
  (current_setting('test.dana')::uuid, 'authenticated', 'authenticated', 'dana48@test.local');

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

insert into public.foods (name, source, kcal_per_100g, store_section, servings, package_grams, household_id) values
  ('Rice 48', 'label', 365, 'Canned & dry goods', '[]', 1000, current_setting('test.alice_hh')::bigint),
  ('Bob food 48', 'label', 100, 'Produce', '[]', null, current_setting('test.bob_hh')::bigint);
select set_config('test.rice', (select id::text from public.foods where name = 'Rice 48'), true);
select set_config('test.bobfood', (select id::text from public.foods where name = 'Bob food 48'), true);
insert into public.pantry_items (household_id, food_id, grams)
  values (current_setting('test.alice_hh')::bigint, current_setting('test.rice')::bigint, 300);

-- Dana adds a free-text line and a food line with an amount
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dana'), 'role', 'authenticated')::text, true);

select is((public.shopping_add_line('48000000-0000-4000-8000-000000000001', 'Foil', null, null, 'one roll') ->> 'created')::boolean, true, 'a free-text line is created');
select is((select source from public.grocery_list where client_id = '48000000-0000-4000-8000-000000000001'), 'hand', 'it is a hand line');
select is((select quantity_needed from public.grocery_list where client_id = '48000000-0000-4000-8000-000000000001'), 'one roll', 'it keeps its text');
select is((select store_section from public.grocery_list where client_id = '48000000-0000-4000-8000-000000000001'), 'Other', 'a line with no food is in Other');

select is((public.shopping_add_line('48000000-0000-4000-8000-000000000002', '', current_setting('test.rice')::bigint, 500, null) ->> 'created')::boolean, true, 'a food line with an amount is created');
select is((select item_name from public.grocery_list where client_id = '48000000-0000-4000-8000-000000000002'), 'Rice 48', 'a blank name takes the food name');
select is((select grams from public.grocery_list where client_id = '48000000-0000-4000-8000-000000000002'), 500::numeric, 'it keeps its grams');
select is((select store_section from public.grocery_list where client_id = '48000000-0000-4000-8000-000000000002'), 'Canned & dry goods', 'it takes the food store section');
select is((select quantity_needed from public.grocery_list where client_id = '48000000-0000-4000-8000-000000000002'), '500 g', 'and a text from the grams when none is given');

-- A replayed add changes nothing
select is((public.shopping_add_line('48000000-0000-4000-8000-000000000001', 'Foil', null, null, 'one roll') ->> 'created')::boolean, false, 'a replayed add is not created again');
select is((select count(*)::int from public.grocery_list where item_name = 'Foil'), 1, 'and there is still one Foil line');

-- Bad input
select throws_ok($$select public.shopping_add_line('48000000-0000-4000-8000-000000000003', '  ', null, null, null)$$, '22023', null, 'a line with no name and no food is refused');
select throws_ok($$select public.shopping_add_line('48000000-0000-4000-8000-000000000004', 'Salt', null, 50, null)$$, '22023', null, 'grams without a food are refused');
select throws_ok(format($$select public.shopping_add_line('48000000-0000-4000-8000-000000000005', 'Bob food', %s, null, null)$$, current_setting('test.bobfood')), '42501', null, 'a food from another Household is refused');

-- Two Members tick the same line while offline; both ticks are replayed later and the Pantry
-- is added to once. (Dana adds the line, then Alice and Dana each replay a Bought.)
select set_config('test.l_rice', (public.shopping_add_line('48000000-0000-4000-8000-000000000006', 'Rice again', current_setting('test.rice')::bigint, 1000, null) ->> 'line_id'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.grocery_list where source = 'hand'), 3, 'every Member of the Household sees the hand lines');
select is((public.shopping_tick(current_setting('test.l_rice')::bigint, 'bought') ->> 'applied')::boolean, true, 'the first replayed tick is applied');
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dana'), 'role', 'authenticated')::text, true);
select is((public.shopping_tick(current_setting('test.l_rice')::bigint, 'bought') ->> 'applied')::boolean, false, 'the second replayed tick is not applied');
select is((select grams from public.pantry_items where food_id = current_setting('test.rice')::bigint), 1300::numeric, 'the Pantry is added to once: 300 + 1000');

-- Another Household sees none of it and cannot reuse the id
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.grocery_list where source = 'hand'), 0, 'another Household does not see the hand lines');
select throws_ok($$select public.shopping_add_line('48000000-0000-4000-8000-000000000001', 'Foil', null, null, null)$$, '42501', null, 'another Household cannot reuse the id');

select * from finish();
rollback;
