-- Calorie Manager: Scan tries every padding of a barcode (migration 034)
-- Run against a LOCAL stack only: `supabase start`, then `supabase test db`.
-- usda_get is replaced inside this transaction: it records each query and finds nothing,
-- so the test sees which paddings were tried, in order, without calling USDA.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

create temp table usda_queries (n serial, q text);
grant all on usda_queries to authenticated;
grant usage on sequence usda_queries_n_seq to authenticated;

create or replace function public.usda_get(p_path text)
returns jsonb
language plpgsql as $$
begin
  insert into usda_queries (q) values (split_part(p_path, 'query=', 2));
  return '{"foods": []}'::jsonb;
end $$;

select ok(
  has_function_privilege('authenticated', 'public.usda_lookup_gtin(text)', 'execute'),
  'signed-in Members may still call usda_lookup_gtin');

select set_config('test.alice', '11111111-1111-4111-8111-111111111111', true);
insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice@test.local');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select public.create_household('Alice house', 'Alice');

select is(public.usda_lookup_gtin('041196910759'), null, 'a 12-digit UPC USDA lacks returns null');
select results_eq(
  'select q from usda_queries order by n',
  $$values ('041196910759'), ('0041196910759'), ('00041196910759')$$,
  'the UPC is tried as scanned, then padded to 13 and 14 digits, each once');

delete from usda_queries;
select public.usda_lookup_gtin('0-41196-91075-9 ');
select is((select count(*)::int from usda_queries), 3, 'dashes and spaces are stripped before the tries');

select * from finish();
rollback;
