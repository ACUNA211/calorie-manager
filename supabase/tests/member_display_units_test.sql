-- Calorie Manager: display units (ticket #11)
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`.
-- Household Alice: Owner, with an adult Member ("Carl") and a Dependent ("Kid").
-- Household Bob: Owner, in another Household. Rows are seeded as the database owner.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select set_config('test.alice', '88888888-8888-4888-8888-888888888888', true);
select set_config('test.bob', '99999999-9999-4999-8999-999999999999', true);
select set_config('test.carl', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice11@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob11@test.local'),
  (current_setting('test.carl')::uuid, 'authenticated', 'authenticated', 'carl11@test.local');

-- Alice and Bob each create a Household through the RPC
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Alice house 11', 'Alice'))::text, true);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.bob_hh', (select public.create_household('Bob house 11', 'Bob'))::text, true);
reset role;

select set_config('test.alice_m', (select id::text from public.members where user_id = current_setting('test.alice')::uuid), true);
select set_config('test.bob_m', (select id::text from public.members where user_id = current_setting('test.bob')::uuid), true);
insert into public.members (household_id, user_id, display_name, role) values
  (current_setting('test.alice_hh')::bigint, current_setting('test.carl')::uuid, 'Carl', 'member');
insert into public.members (household_id, user_id, display_name, role) values
  (current_setting('test.alice_hh')::bigint, null, 'Kid', 'dependent');
select set_config('test.kid_m', (select id::text from public.members where display_name = 'Kid'), true);

-- 1. The default and the check (as the database owner) ----------------------------
select is(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'members' and column_name = 'display_units'),
  '''us''::text',
  'a new Member defaults to US units'
);

do $$
begin
  update public.members set display_units = 'imperial' where id = current_setting('test.alice_m')::bigint;
  perform set_config('test.bad_units', 'ok', true);
exception when others then
  perform set_config('test.bad_units', sqlstate, true);
end $$;
select is(current_setting('test.bad_units'), '23514', 'an unknown unit system is refused');

-- 2. Alice (Owner) as authenticated: her own Member and her Dependent ------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
do $$
begin
  update public.members set display_units = 'metric' where id = current_setting('test.alice_m')::bigint;
  perform set_config('test.a_own', 'ok', true);
exception when others then
  perform set_config('test.a_own', sqlstate, true);
end $$;
select is(current_setting('test.a_own'), 'ok', 'a Member can set her own units');
select is(
  (select display_units from public.members where id = current_setting('test.alice_m')::bigint),
  'metric',
  'the new units are read back'
);
do $$
begin
  update public.members set display_units = 'metric' where id = current_setting('test.kid_m')::bigint;
  perform set_config('test.a_kid', 'ok', true);
exception when others then
  perform set_config('test.a_kid', sqlstate, true);
end $$;
select is(current_setting('test.a_kid'), 'ok', 'an adult can set a Dependent units');

-- 3. Carl (another adult in Alice''s Household) -------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.carl'), 'role', 'authenticated')::text, true);
do $$
begin
  update public.members set display_units = 'us' where id = current_setting('test.kid_m')::bigint;
  perform set_config('test.c_kid', 'ok', true);
exception when others then
  perform set_config('test.c_kid', sqlstate, true);
end $$;
select is(current_setting('test.c_kid'), 'ok', 'another adult in the Household can set the Dependent units');

-- 4. Bob (another Household) changes nothing of Alice's ---------------------------
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
do $$
declare
  n integer;
begin
  update public.members set display_units = 'metric' where id = current_setting('test.alice_m')::bigint;
  get diagnostics n = row_count;
  perform set_config('test.b_alice', n::text, true);
end $$;
select is(current_setting('test.b_alice'), '0', 'a Member of another Household cannot change your units');
do $$
declare
  n integer;
begin
  update public.members set display_units = 'metric' where id = current_setting('test.kid_m')::bigint;
  get diagnostics n = row_count;
  perform set_config('test.b_kid', n::text, true);
end $$;
select is(current_setting('test.b_kid'), '0', 'a Member of another Household cannot change a Dependent units');

-- 5. Only display_units is writable by the app ------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
do $$
begin
  update public.members set display_name = 'Renamed' where id = current_setting('test.alice_m')::bigint;
  perform set_config('test.a_name', 'ok', true);
exception when others then
  perform set_config('test.a_name', sqlstate, true);
end $$;
select is(current_setting('test.a_name'), '42501', 'the app cannot change a Member name through this grant');

-- 6. Anonymous visitors ---------------------------------------------------------------
set local role anon;
do $$
begin
  update public.members set display_units = 'metric' where id = current_setting('test.alice_m')::bigint;
  perform set_config('test.anon_units', 'ok', true);
exception when others then
  perform set_config('test.anon_units', sqlstate, true);
end $$;
select is(current_setting('test.anon_units'), '42501', 'an anonymous visitor cannot change units');
reset role;

-- 7. The last change to the Dependent is Carl's ------------------------------------
select is(
  (select display_units from public.members where id = current_setting('test.kid_m')::bigint),
  'us',
  'the Dependent holds the last value saved, by Carl'
);

select * from finish();
rollback;
