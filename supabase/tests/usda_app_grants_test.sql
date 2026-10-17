-- Calorie Manager: the Foods screens can call usda_search and usda_save as a signed-in
-- Member (migration 024). usda_get keeps no grant for signed-in users (it holds the USDA key).
-- Grant checks only, so no USDA call and no data. Run against a LOCAL stack only:
-- `supabase start`, then `supabase test db`. Not run yet (no local stack was started here).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select ok(
  has_function_privilege('authenticated', 'public.usda_search(text, int)', 'execute'),
  'signed-in Members may call usda_search');
select ok(
  has_function_privilege('authenticated', 'public.usda_save(bigint)', 'execute'),
  'signed-in Members may call usda_save');
select ok(
  not has_function_privilege('authenticated', 'public.usda_get(text)', 'execute'),
  'signed-in Members may not call usda_get directly (it holds the USDA key)');

select ok(
  not has_function_privilege('anon', 'public.usda_search(text, int)', 'execute'),
  'anon may not call usda_search');
select ok(
  not has_function_privilege('anon', 'public.usda_save(bigint)', 'execute'),
  'anon may not call usda_save');
select ok(
  not has_function_privilege('anon', 'public.usda_get(text)', 'execute'),
  'anon may not call usda_get');
select ok(
  not has_function_privilege('anon', 'public.usda_lookup_gtin(text)', 'execute'),
  'anon may not call usda_lookup_gtin');

select * from finish();
rollback;
