-- Calorie Manager: client_id on the Calorie Log (ticket #34)
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`.
-- An entry logged offline carries a client_id. Sending it twice must store it once: the second
-- insert is refused with unique_violation (23505), which the app reads as "already saved".
-- Rows with no client_id (every row from before this migration) stay allowed in any number.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select set_config('test.alice', '99999999-9999-4999-8999-999999999999', true);
insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice34@test.local');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Offline house', 'Alice'))::text, true);
reset role;
select set_config('test.alice_m', (select id::text from public.members where user_id = current_setting('test.alice')::uuid), true);

-- 1. The column exists and is nullable
select col_is_null('public', 'calorie_log', 'client_id', 'calorie_log.client_id is nullable');

-- 2. An entry with a client_id is stored as given
insert into public.calorie_log (member_id, log_date, description, grams, kcal, client_id)
  values (current_setting('test.alice_m')::bigint, '2026-10-17', 'Queued apple', 100, 52,
          '11111111-2222-4333-8444-555555555555');
select is(
  (select count(*)::int from public.calorie_log where client_id = '11111111-2222-4333-8444-555555555555'),
  1,
  'an entry with a client_id is stored once'
);

-- 3. Sending the same client_id again is refused, so the food is not logged twice
select throws_ok(
  $$insert into public.calorie_log (member_id, log_date, description, grams, kcal, client_id)
    values ((select id from public.members where display_name = 'Alice'), '2026-10-17', 'Queued apple', 100, 52,
            '11111111-2222-4333-8444-555555555555')$$,
  '23505',
  null,
  'a resent client_id is refused as a duplicate'
);

-- 4. Rows without a client_id do not clash with each other
insert into public.calorie_log (member_id, log_date, description, grams, kcal)
  values (current_setting('test.alice_m')::bigint, '2026-10-17', 'Online pear', 100, 57);
insert into public.calorie_log (member_id, log_date, description, grams, kcal)
  values (current_setting('test.alice_m')::bigint, '2026-10-17', 'Online plum', 100, 46);
select is(
  (select count(*)::int from public.calorie_log where client_id is null and log_date = '2026-10-17'),
  2,
  'several rows with no client_id are allowed'
);

select * from finish();
rollback;
