-- Calorie Manager: weight log (ticket #32)
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`.
-- Household Alice: Owner, with a Dependent ("Kid") and an adult Member ("Carl").
-- Household Bob: Owner. Each signs in as authenticated and records outcomes in settings;
-- assertions run as the database owner. Rows are seeded as the database owner.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

select set_config('test.alice', '55555555-5555-4555-8555-555555555555', true);
select set_config('test.bob', '66666666-6666-4666-8666-666666666666', true);
select set_config('test.carl', '77777777-7777-4777-8777-777777777777', true);

insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice32@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob32@test.local'),
  (current_setting('test.carl')::uuid, 'authenticated', 'authenticated', 'carl32@test.local');

-- Alice and Bob each create a Household through the RPC
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Alice house', 'Alice'))::text, true);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.bob_hh', (select public.create_household('Bob house', 'Bob'))::text, true);
reset role;

-- Members: Alice and Bob (Owners), Carl (adult, same Household as Alice), Kid (Dependent of Alice)
select set_config('test.alice_m', (select id::text from public.members where user_id = current_setting('test.alice')::uuid), true);
select set_config('test.bob_m', (select id::text from public.members where user_id = current_setting('test.bob')::uuid), true);
insert into public.members (household_id, user_id, display_name, role) values
  (current_setting('test.alice_hh')::bigint, current_setting('test.carl')::uuid, 'Carl', 'member');
insert into public.members (household_id, user_id, display_name, role) values
  (current_setting('test.alice_hh')::bigint, null, 'Kid', 'dependent');
select set_config('test.carl_m', (select id::text from public.members where display_name = 'Carl'), true);
select set_config('test.kid_m', (select id::text from public.members where display_name = 'Kid'), true);

-- Weights: one each for Alice, Kid and Bob on the same day
insert into public.weight_log (member_id, log_date, kg) values
  (current_setting('test.alice_m')::bigint, '2026-10-16', 72.5),
  (current_setting('test.kid_m')::bigint, '2026-10-16', 30.0),
  (current_setting('test.bob_m')::bigint, '2026-10-16', 80.0);

-- Alice (Owner) as authenticated: sees her own and her Dependent's weight, not Bob's
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.a_visible', (select count(*) from public.weight_log)::text, true);
select set_config('test.a_bob_visible', (select count(*) from public.weight_log where member_id = current_setting('test.bob_m')::bigint)::text, true);
do $$
begin
  insert into public.weight_log (member_id, log_date, kg)
    values (current_setting('test.kid_m')::bigint, '2026-10-17', 30.2);
  perform set_config('test.a_insert_kid', 'ok', true);
exception when others then
  perform set_config('test.a_insert_kid', sqlstate, true);
end $$;
do $$
begin
  insert into public.weight_log (member_id, log_date, kg)
    values (current_setting('test.bob_m')::bigint, '2026-10-17', 81.0);
  perform set_config('test.a_insert_bob', 'ok', true);
exception when others then
  perform set_config('test.a_insert_bob', sqlstate, true);
end $$;
do $$
declare n int := -1;
begin
  update public.weight_log set kg = 1.0 where member_id = current_setting('test.bob_m')::bigint;
  get diagnostics n = row_count;
  perform set_config('test.a_update_bob', n::text, true);
end $$;
do $$
declare n int := -1;
begin
  update public.weight_log set kg = 72.0 where member_id = current_setting('test.alice_m')::bigint;
  get diagnostics n = row_count;
  perform set_config('test.a_update_own', n::text, true);
end $$;
reset role;

-- Carl (adult Member of Alice's Household) as authenticated: another adult Member
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.carl'), 'role', 'authenticated')::text, true);
select set_config('test.c_alice_visible', (select count(*) from public.weight_log where member_id = current_setting('test.alice_m')::bigint)::text, true);
select set_config('test.c_kid_visible', (select count(*) from public.weight_log where member_id = current_setting('test.kid_m')::bigint)::text, true);
select set_config('test.c_bob_visible', (select count(*) from public.weight_log where member_id = current_setting('test.bob_m')::bigint)::text, true);
do $$
begin
  insert into public.weight_log (member_id, log_date, kg)
    values (current_setting('test.alice_m')::bigint, '2026-10-17', 70.0);
  perform set_config('test.c_insert_alice', 'ok', true);
exception when others then
  perform set_config('test.c_insert_alice', sqlstate, true);
end $$;
reset role;

-- Bob (Owner of another Household) as authenticated
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.b_alice_visible', (select count(*) from public.weight_log where member_id = current_setting('test.alice_m')::bigint)::text, true);
select set_config('test.b_kid_visible', (select count(*) from public.weight_log where member_id = current_setting('test.kid_m')::bigint)::text, true);
select set_config('test.b_visible', (select count(*) from public.weight_log)::text, true);
reset role;

-- Anonymous visitor
set local role anon;
do $$
declare n int;
begin
  select count(*) into n from public.weight_log;
  perform set_config('test.anon_wl', n::text, true);
exception when insufficient_privilege then
  perform set_config('test.anon_wl', 'denied', true);
end $$;
reset role;

-- Assertions (database owner)
select is(current_setting('test.a_visible'), '2', 'the Owner sees her own weight and her Dependent weight, not those of Bob');
select is(current_setting('test.a_bob_visible'), '0', 'the Owner cannot see another Owner weight');
select is(current_setting('test.a_insert_kid'), 'ok', 'the adult can log a weight for her Dependent');
select is(current_setting('test.a_insert_bob'), '42501', 'the Owner cannot log a weight for another Member');
select is(current_setting('test.a_update_bob'), '0', 'the Owner cannot change another Member''s weight');
select is(current_setting('test.a_update_own'), '1', 'the Member can change their own weight');
select is(current_setting('test.c_alice_visible'), '0', 'another adult Member cannot read your weight');
select is(current_setting('test.c_kid_visible'), '2', 'another adult Member reads a Dependent weight in the Household');
select is(current_setting('test.c_bob_visible'), '0', 'another adult Member cannot read a weight in another Household');
select is(current_setting('test.c_insert_alice'), '42501', 'another adult Member cannot log a weight for you');
select is(current_setting('test.b_alice_visible'), '0', 'a Member of another Household cannot read your weight');
select is(current_setting('test.b_kid_visible'), '0', 'a Member of another Household cannot read a Dependent weight');
select is(current_setting('test.b_visible'), '1', 'Bob sees only his own weight row');
select is(current_setting('test.anon_wl'), 'denied', 'an anonymous visitor cannot read the weight log');

select throws_ok(
  $$insert into public.weight_log (member_id, log_date, kg) values (current_setting('test.alice_m')::bigint, '2026-10-16', 73.0)$$,
  '23505',
  null,
  'one weight per Member per day'
);
select throws_ok(
  $$insert into public.weight_log (member_id, log_date, kg) values (current_setting('test.alice_m')::bigint, '2026-10-15', 19.9)$$,
  '23514',
  null,
  'a weight below 20 kg is refused'
);
select throws_ok(
  $$insert into public.weight_log (member_id, log_date, kg) values (current_setting('test.alice_m')::bigint, '2026-10-15', 400.1)$$,
  '23514',
  null,
  'a weight above 400 kg is refused'
);
select has_function('private', 'weight_readable_by_caller', array['bigint'], 'the read hook for ticket 33 exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.weight_log'::regclass),
  'row-level security is on for weight_log'
);
select is(
  (select count(*)::text from public.weight_log where member_id = current_setting('test.kid_m')::bigint),
  '2', 'the Dependent has two weights after the Owner logged one for her'
);
select is(
  (select kg::text from public.weight_log where member_id = current_setting('test.alice_m')::bigint),
  '72.0', 'the Owner''s own weight was changed to 72.0 kg'
);

select * from finish();
rollback;
