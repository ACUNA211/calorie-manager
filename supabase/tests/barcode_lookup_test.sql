-- Calorie Manager: Scan's barcode lookup (ticket #18)
-- Run against a LOCAL stack only: `supabase start`, then `supabase test db`. Not run yet
-- (no local stack was started for this ticket).
-- usda_get is replaced inside this transaction so that any USDA call raises an error:
-- a Food Library hit must return before USDA is reached, and a miss must reach it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select set_config('test.alice', '11111111-1111-4111-8111-111111111111', true);
insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice@test.local');

create or replace function public.usda_get(p_path text)
returns jsonb
language plpgsql as $$
begin
  raise exception 'USDA called: %', p_path;
end $$;

select ok(
  has_function_privilege('authenticated', 'public.usda_lookup_gtin(text)', 'execute'),
  'signed-in Members may call usda_lookup_gtin');
select ok(
  not has_function_privilege('anon', 'public.usda_lookup_gtin(text)', 'execute'),
  'anon may not call usda_lookup_gtin');

-- Alice creates a Household and a Food Library food with a UPC-A
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select public.create_household('Alice house', 'Alice');
insert into public.foods (name, source, kcal_per_100g, gtin) values ('Alice oats', 'estimated', 370, '036000291452');
select set_config('test.oats', (select id from public.foods where name = 'Alice oats')::text, true);

select is(
  (public.usda_lookup_gtin('036000291452'))->>'food_id',
  current_setting('test.oats'),
  '12-digit code finds the Food Library food without calling USDA');
select is(
  (public.usda_lookup_gtin('0036000291452'))->>'food_id',
  current_setting('test.oats'),
  '13-digit zero-padded code finds the same food');
select is(
  (public.usda_lookup_gtin('00036000291452'))->>'food_id',
  current_setting('test.oats'),
  '14-digit zero-padded code finds the same food');

select throws_like(
  $$select public.usda_lookup_gtin('999999999999')$$,
  'USDA called%',
  'a code not in the Food Library goes on to USDA');

select * from finish();
rollback;
