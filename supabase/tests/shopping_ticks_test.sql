-- Calorie Manager: Bought / Have it, migration 046 (ticket #47)
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`. Not run when written.
-- Alice (Owner) has Dana (Member); Bob (Owner) has his own Household.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

select set_config('test.alice', '99999999-9999-4999-8999-999999999971', true);
select set_config('test.bob', '99999999-9999-4999-8999-999999999972', true);
select set_config('test.dana', '99999999-9999-4999-8999-999999999973', true);
insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice47@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob47@test.local'),
  (current_setting('test.dana')::uuid, 'authenticated', 'authenticated', 'dana47@test.local');

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
  ('Rice 47', 'label', 365, 'Canned & dry goods', '[]', 1000, current_setting('test.alice_hh')::bigint),
  ('Beans 47', 'label', 90, 'Canned & dry goods', '[]', null, current_setting('test.alice_hh')::bigint),
  ('Apple 47', 'label', 52, 'Produce', '[]', null, current_setting('test.alice_hh')::bigint),
  ('Salt 47', 'label', 0, 'Pantry', '[]', null, current_setting('test.alice_hh')::bigint);
select set_config('test.rice', (select id::text from public.foods where name = 'Rice 47'), true);
select set_config('test.beans', (select id::text from public.foods where name = 'Beans 47'), true);
select set_config('test.apple', (select id::text from public.foods where name = 'Apple 47'), true);
select set_config('test.salt', (select id::text from public.foods where name = 'Salt 47'), true);

insert into public.pantry_items (household_id, food_id, grams) values
  (current_setting('test.alice_hh')::bigint, current_setting('test.rice')::bigint, 300),
  (current_setting('test.alice_hh')::bigint, current_setting('test.beans')::bigint, 900);

-- Lines: rice 1000 g (need 700), beans 200 g, apple 150 g (no Pantry row), a hand line, salt 50 g
insert into public.grocery_list (item_name, quantity_needed, food_id, source, grams, need_grams, household_id) values
  ('Rice 47', '1 × package', current_setting('test.rice')::bigint, 'plan', 1000, 700, current_setting('test.alice_hh')::bigint),
  ('Beans 47', '200 g', current_setting('test.beans')::bigint, 'plan', 200, 200, current_setting('test.alice_hh')::bigint),
  ('Apple 47', '150 g', current_setting('test.apple')::bigint, 'plan', 150, 150, current_setting('test.alice_hh')::bigint),
  ('Foil 47', 'one roll', null, 'hand', null, null, current_setting('test.alice_hh')::bigint),
  ('Salt 47', '50 g', current_setting('test.salt')::bigint, 'plan', 50, 50, current_setting('test.alice_hh')::bigint);
select set_config('test.l_rice', (select id::text from public.grocery_list where item_name = 'Rice 47'), true);
select set_config('test.l_beans', (select id::text from public.grocery_list where item_name = 'Beans 47'), true);
select set_config('test.l_apple', (select id::text from public.grocery_list where item_name = 'Apple 47'), true);
select set_config('test.l_foil', (select id::text from public.grocery_list where item_name = 'Foil 47'), true);
select set_config('test.l_salt', (select id::text from public.grocery_list where item_name = 'Salt 47'), true);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dana'), 'role', 'authenticated')::text, true);

-- Bought adds the line's grams
select is((public.shopping_tick(current_setting('test.l_rice')::bigint, 'bought') ->> 'pantry_grams')::numeric, 1300::numeric, 'Bought adds the line grams: 300 + 1000');
select ok((select purchased from public.grocery_list where id = current_setting('test.l_rice')::bigint), 'the line is ticked');

-- Ticking again changes nothing (no double count)
select is((public.shopping_tick(current_setting('test.l_rice')::bigint, 'bought') ->> 'applied')::boolean, false, 'a second tick is not applied');
select is((select grams from public.pantry_items where food_id = current_setting('test.rice')::bigint), 1300::numeric, 'the Pantry is not doubled');
select is((public.shopping_tick(current_setting('test.l_rice')::bigint, 'have_it') ->> 'applied')::boolean, false, 'Have it on a Bought line is not applied');

-- Have it raises to the needed amount, never lowers
select is((public.shopping_tick(current_setting('test.l_apple')::bigint, 'have_it') ->> 'pantry_grams')::numeric, 150::numeric, 'Have it with no Pantry row creates one at the need');
select is((public.shopping_tick(current_setting('test.l_beans')::bigint, 'have_it') ->> 'pantry_grams')::numeric, 900::numeric, 'Have it leaves a bigger Pantry amount alone');
select is((select pantry_delta from public.shopping_ticks where line_id = current_setting('test.l_beans')::bigint), 0::numeric, 'a Have it that changed nothing records a delta of 0');

-- A hand line with no food only gets ticked
select is((public.shopping_tick(current_setting('test.l_foil')::bigint, 'bought') ->> 'applied')::boolean, true, 'a hand line without a food can be ticked');
select is((select count(*)::int from public.pantry_items), 3, 'and adds nothing to the Pantry');

-- Scan (ticket 49): the real package weight replaces the planned amount
select is((public.shopping_tick(current_setting('test.l_salt')::bigint, 'bought', 750) ->> 'pantry_grams')::numeric, 750::numeric, 'Bought with a scanned weight adds that weight');

-- Bad input
select throws_ok($$select public.shopping_tick(0, 'bought')$$, '42501', null, 'a missing line is refused');
select throws_ok(format($$select public.shopping_tick(%s, 'nope')$$, current_setting('test.l_foil')), '22023', null, 'an unknown tick is refused');

-- Undo reverses exactly the tick
select is((public.shopping_untick(current_setting('test.l_rice')::bigint) ->> 'pantry_grams')::numeric, 300::numeric, 'Undo of Bought takes the grams back: 1300 - 1000');
select ok(not (select purchased from public.grocery_list where id = current_setting('test.l_rice')::bigint), 'Undo unticks the line');
select is((select count(*)::int from public.shopping_ticks where line_id = current_setting('test.l_rice')::bigint), 0, 'Undo forgets the tick');
select lives_ok(format($$select public.shopping_untick(%s)$$, current_setting('test.l_apple')), 'Undo of a Have it works');
select is((select count(*)::int from public.pantry_items where food_id = current_setting('test.apple')::bigint), 0, 'it removes the Pantry row the tick created');

-- Ticked lines are never unticked by a direct update
select throws_ok(format($$update public.grocery_list set purchased = false where id = %s$$, current_setting('test.l_beans')), '42501', null, 'a direct untick is refused');

-- After the undo window the tick is final
reset role;
update public.shopping_ticks set ticked_at = now() - interval '30 seconds' where line_id = current_setting('test.l_beans')::bigint;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dana'), 'role', 'authenticated')::text, true);
select throws_ok(format($$select public.shopping_untick(%s)$$, current_setting('test.l_beans')), '42501', null, 'Undo is refused once the time has passed');

-- Another Household cannot tick or undo
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select throws_ok(format($$select public.shopping_tick(%s, 'bought')$$, current_setting('test.l_salt')), '42501', null, 'another Household cannot tick the line');
select throws_ok(format($$select public.shopping_untick(%s)$$, current_setting('test.l_salt')), '42501', null, 'another Household cannot undo the tick');
select is((select count(*)::int from public.shopping_ticks), 0, 'another Household cannot read the ticks');

select * from finish();
rollback;
