-- Calorie Manager: a food typed in from its label (ticket #20)
-- Run against a LOCAL stack only: `supabase start`, then `supabase test db`. NOT RUN: the
-- database tests run in ticket #69, and no local stack was started for this ticket.
-- Alice owns a Household and saves a typed label food with a barcode. Scanning that barcode
-- again finds it in her Food Library (usda_lookup_gtin answers from the library, no USDA).
-- Bob's Household gets no sight of it, and saving the same barcode again adds nothing.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

select set_config('test.alice', '11111111-1111-4111-8111-111111111111', true);
select set_config('test.bob', '22222222-2222-4222-8222-222222222222', true);
insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob@test.local');

select ok(
  has_function_privilege('authenticated', 'public.save_label_food(text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric)', 'execute'),
  'signed-in Members may run save_label_food');
select ok(
  not has_function_privilege('anon', 'public.save_label_food(text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric)', 'execute'),
  'anon may not run save_label_food');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Alice house', 'Alice'))::text, true);

-- Per 100 g values as the app converts them: 46 kcal, 1 g protein, 6 g carbs, 1.5 g fat
select set_config('test.label', (select public.save_label_food(
  '036000291452', 'Oat drink', 'Oatly', 250, 46, 1, 6, 1.5, null, 3, null
))::text, true);

select ok(current_setting('test.label')::bigint > 0, 'saving a label food returns its Food Library id');
select is(
  (select source from public.foods where id = current_setting('test.label')::bigint),
  'label',
  'the food is marked as typed from a label');
select is(
  (select gtin from public.foods where id = current_setting('test.label')::bigint),
  '00036000291452',
  'the barcode is stored as a 14-digit GTIN');
select is(
  (select brand from public.foods where id = current_setting('test.label')::bigint),
  'Oatly',
  'the brand is stored');
select is(
  (select kcal_per_100g from public.foods where id = current_setting('test.label')::bigint),
  46::numeric,
  'calories are stored per 100 g as the app sent them');
select is(
  (select protein_g from public.foods where id = current_setting('test.label')::bigint),
  1::numeric,
  'protein is stored per 100 g');
select is(
  (select (servings->0->>'grams')::numeric from public.foods where id = current_setting('test.label')::bigint),
  250::numeric,
  'the serving size is stored in grams');
select ok(
  (select fibre_g is null from public.foods where id = current_setting('test.label')::bigint),
  'a blank fibre stays NULL, never 0');

select is(
  public.save_label_food('036000291452', 'Oat drink', 'Oatly', 250, 46, 1, 6, 1.5, null, 3, null),
  current_setting('test.label')::bigint,
  'saving the same barcode again returns the same food');
select is(
  (select count(*)::int from public.foods where ltrim(gtin, '0') = '36000291452'),
  1,
  'the same barcode is stored once in the Household');
select is(
  (public.usda_lookup_gtin('036000291452'))->>'food_id',
  current_setting('test.label'),
  'scanning the barcode again finds the typed food in the Food Library first');

select throws_ok(
  $$select public.save_label_food('12345', 'Bad', null, 100, 10, 1, 1, 1, null, null, null)$$,
  '22023', null, 'a barcode of the wrong length is rejected');
select throws_ok(
  $$select public.save_label_food('036000291452', 'Bad', null, 0, 10, 1, 1, 1, null, null, null)$$,
  '22023', null, 'a serving of 0 g is rejected');
select throws_ok(
  $$select public.save_label_food('036000291452', 'Bad', null, 100, -1, 1, 1, 1, null, null, null)$$,
  '22023', null, 'negative calories are rejected');
select throws_ok(
  $$select public.save_label_food('036000291452', 'Bad', null, 100, 10, null, 1, 1, null, null, null)$$,
  '22023', null, 'a missing protein is rejected');
select throws_ok(
  $$select public.save_label_food('036000291452', '   ', null, 100, 10, 1, 1, 1, null, null, null)$$,
  '22023', null, 'a blank name is rejected');
select throws_ok(
  $$select public.save_label_food('036000291452', 'Bad', null, 100, 10, 1, 1, 1, null, null, 50000)$$,
  '22023', null, 'sodium out of range is rejected');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.bob_hh', (select public.create_household('Bob house', 'Bob'))::text, true);

select is(
  (select count(*)::int from public.foods where ltrim(gtin, '0') = '36000291452'),
  0,
  'Bob sees none of Alice''s typed food');
select isnt(
  public.save_label_food('036000291452', 'Oat drink', 'Oatly', 250, 46, 1, 6, 1.5, null, 3, null),
  current_setting('test.label')::bigint,
  'Bob saves the barcode into his own Household, not Alice''s');
select is(
  (select household_id from public.foods where id = public.save_label_food('036000291452', 'Oat drink', 'Oatly', 250, 46, 1, 6, 1.5, null, 3, null)),
  current_setting('test.bob_hh')::bigint,
  'the food lands in the caller''s Household');

reset role;
select * from finish();
rollback;
