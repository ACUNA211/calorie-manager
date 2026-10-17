-- Calorie Manager: Open Food Facts storage (ticket #19)
-- Run against a LOCAL stack only: `supabase start`, then `supabase test db`. NOT RUN: the
-- database tests run in ticket #69, and no local stack was started for this ticket.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select set_config('test.alice', '11111111-1111-4111-8111-111111111111', true);
insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice@test.local');

-- The table owner stores a product here; the Edge Function does the same with the service role
insert into public.off_products (barcode, off_code, product) values
  ('36000291452', '0036000291452', '{"code":"0036000291452","product_name":"Oats"}');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.off_products'::regclass),
  'off_products has row-level security on');
select ok(
  not has_table_privilege('anon', 'public.off_products', 'select'),
  'anon may not read off_products');
select ok(
  not has_table_privilege('authenticated', 'public.off_products', 'insert'),
  'signed-in Members may not insert into off_products');
select ok(
  not has_table_privilege('authenticated', 'public.off_products', 'update'),
  'signed-in Members may not update off_products');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);

select is(
  (select count(*)::int from public.off_products where barcode = '36000291452'),
  1,
  'a signed-in Member reads the stored Open Food Facts product');
select is(
  (select product->>'product_name' from public.off_products where barcode = '36000291452'),
  'Oats',
  'the product is stored exactly as Open Food Facts gave it');
select throws_ok(
  $$insert into public.off_products (barcode, off_code, product) values ('1', '1', '{}')$$,
  '42501',
  null,
  'a signed-in Member cannot write an Open Food Facts product');
select ok(
  not has_table_privilege('authenticated', 'public.off_read_log', 'select'),
  'signed-in Members may not read the read log');

reset role;
select throws_ok(
  $$insert into public.off_products (barcode, off_code, product) values ('0', '0', '{}')$$,
  '23514',
  null,
  'a barcode with a leading zero is rejected (the key has none)');
select is(
  (select count(*)::int from public.off_read_log),
  0,
  'the read log starts empty');

select * from finish();
rollback;
