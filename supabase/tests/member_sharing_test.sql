-- Calorie Manager: what other Members see (ticket #33)
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`.
-- Household Alice: Owner, with an adult Member ("Carl") and a Dependent ("Kid").
-- Household Bob: Owner, a different Household. Each signs in as authenticated; assertions run as
-- the database owner. Rows are seeded as the database owner.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

select set_config('test.alice', '88888888-8888-4888-8888-888888888888', true);
select set_config('test.bob', '99999999-9999-4999-8999-999999999999', true);
select set_config('test.carl', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice33@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob33@test.local'),
  (current_setting('test.carl')::uuid, 'authenticated', 'authenticated', 'carl33@test.local');

-- Alice and Bob each create a Household through the RPC
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Alice house 33', 'Alice'))::text, true);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.bob_hh', (select public.create_household('Bob house 33', 'Bob'))::text, true);
reset role;

-- Carl (adult Member of Alice's Household) and Kid (Dependent of Alice's Household)
insert into public.members (household_id, user_id, display_name, role) values
  (current_setting('test.alice_hh')::bigint, current_setting('test.carl')::uuid, 'Carl33', 'member');
insert into public.members (household_id, user_id, display_name, role) values
  (current_setting('test.alice_hh')::bigint, null, 'Kid33', 'dependent');
select set_config('test.alice_m', (select id::text from public.members where user_id = current_setting('test.alice')::uuid), true);
select set_config('test.bob_m', (select id::text from public.members where user_id = current_setting('test.bob')::uuid), true);
select set_config('test.carl_m', (select id::text from public.members where display_name = 'Carl33'), true);
select set_config('test.kid_m', (select id::text from public.members where display_name = 'Kid33'), true);

-- Targets: Alice 2000 kcal, Kid 1000 kcal, Bob 2000 kcal (each Member's settings row exists from 007)
update public.member_settings set calorie_target = 2000
  where member_id in (current_setting('test.alice_m')::bigint, current_setting('test.bob_m')::bigint);
update public.member_settings set calorie_target = 1000
  where member_id = current_setting('test.kid_m')::bigint;

-- Calorie Log: Alice 2100 kcal on the 15th (over) and 1800 on the 16th (under); Kid 900 on the 16th; Bob 2500 on the 16th
insert into public.calorie_log (member_id, log_date, description, kcal) values
  (current_setting('test.alice_m')::bigint, '2026-10-15', 'Alice dinner', 2100),
  (current_setting('test.alice_m')::bigint, '2026-10-16', 'Alice lunch', 1800),
  (current_setting('test.kid_m')::bigint, '2026-10-16', 'Kid lunch', 900),
  (current_setting('test.bob_m')::bigint, '2026-10-16', 'Bob dinner', 2500);

-- Weight: Alice 72.5 kg
insert into public.weight_log (member_id, log_date, kg) values
  (current_setting('test.alice_m')::bigint, '2026-10-16', 72.5);

-- Carl (another adult in Alice's Household) before Alice shares anything
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.carl'), 'role', 'authenticated')::text, true);
select set_config('test.c_alice_cal', (select count(*) from public.calorie_log where member_id = current_setting('test.alice_m')::bigint)::text, true);
select set_config('test.c_kid_cal', (select count(*) from public.calorie_log where member_id = current_setting('test.kid_m')::bigint)::text, true);
select set_config('test.c_alice_settings', (select count(*) from public.member_settings where member_id = current_setting('test.alice_m')::bigint)::text, true);
select set_config('test.c_alice_weight', (select count(*) from public.weight_log where member_id = current_setting('test.alice_m')::bigint)::text, true);
select set_config('test.c_alice_flags', (select string_agg(day_key::text || ':' || is_over::text, ',' order by day_key) from public.member_day_flags(current_setting('test.alice_m')::bigint, '2026-10-11', '2026-10-17')), true);
select set_config('test.c_kid_flags', (select string_agg(day_key::text || ':' || is_over::text, ',' order by day_key) from public.member_day_flags(current_setting('test.kid_m')::bigint, '2026-10-11', '2026-10-17')), true);
select set_config('test.c_bob_flags', (select count(*) from public.member_day_flags(current_setting('test.bob_m')::bigint, '2026-10-11', '2026-10-17'))::text, true);
do $$
begin
  insert into public.calorie_log (member_id, log_date, description, kcal)
    values (current_setting('test.alice_m')::bigint, '2026-10-17', 'Carl sneaks one in', 300);
  perform set_config('test.c_insert_alice', 'ok', true);
exception when others then
  perform set_config('test.c_insert_alice', sqlstate, true);
end $$;
do $$
declare n int := -1;
begin
  update public.calorie_log set kcal = 1 where member_id = current_setting('test.alice_m')::bigint;
  get diagnostics n = row_count;
  perform set_config('test.c_update_alice', n::text, true);
end $$;
reset role;

-- Alice (Owner) turns on "share everything" through the RPC
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select public.set_share_everything(true);
reset role;

-- Carl now reads Alice's data in full, and Bob still reads none of it
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.carl'), 'role', 'authenticated')::text, true);
select set_config('test.c_alice_cal_shared', (select count(*) from public.calorie_log where member_id = current_setting('test.alice_m')::bigint)::text, true);
select set_config('test.c_alice_settings_shared', (select count(*) from public.member_settings where member_id = current_setting('test.alice_m')::bigint)::text, true);
select set_config('test.c_alice_weight_shared', (select count(*) from public.weight_log where member_id = current_setting('test.alice_m')::bigint)::text, true);
do $$
declare n int := -1;
begin
  update public.calorie_log set kcal = 1 where member_id = current_setting('test.alice_m')::bigint;
  get diagnostics n = row_count;
  perform set_config('test.c_update_alice_shared', n::text, true);
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.b_alice_cal_shared', (select count(*) from public.calorie_log where member_id = current_setting('test.alice_m')::bigint)::text, true);
select set_config('test.b_alice_weight_shared', (select count(*) from public.weight_log where member_id = current_setting('test.alice_m')::bigint)::text, true);
select set_config('test.b_alice_flags_shared', (select count(*) from public.member_day_flags(current_setting('test.alice_m')::bigint, '2026-10-11', '2026-10-17'))::text, true);
reset role;

-- Alice turns "share everything" off again: Carl loses the full data
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select public.set_share_everything(false);
reset role;

-- Carl's own switch changes only Carl's row, not Alice's
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.carl'), 'role', 'authenticated')::text, true);
select set_config('test.c_alice_cal_off', (select count(*) from public.calorie_log where member_id = current_setting('test.alice_m')::bigint)::text, true);
select public.set_share_everything(true);
reset role;

-- Anonymous visitor
set local role anon;
do $$
begin
  perform count(*) from public.member_day_flags(1, '2026-10-11', '2026-10-17');
  perform set_config('test.anon_flags', 'ok', true);
exception when insufficient_privilege then
  perform set_config('test.anon_flags', 'denied', true);
end $$;
reset role;

-- Assertions (database owner)
select is(current_setting('test.c_alice_cal'), '0', 'another adult Member cannot read your Calorie Log by default');
select is(current_setting('test.c_kid_cal'), '1', 'another adult Member reads a Dependent Calorie Log in the Household');
select is(current_setting('test.c_alice_settings'), '0', 'another adult Member cannot read your Targets by default');
select is(current_setting('test.c_alice_weight'), '0', 'another adult Member cannot read your weight by default');
select is(current_setting('test.c_alice_flags'), '2026-10-15:true,2026-10-16:false', 'another adult sees only the on-track or over flag per day for you');
select is(current_setting('test.c_kid_flags'), '2026-10-16:false', 'the flags for a Dependent come from the same function (900 of 1000 kcal is under)');
select is(current_setting('test.c_bob_flags'), '0', 'a Member of another Household gets no flags for your days');
select is(current_setting('test.c_insert_alice'), '42501', 'another adult cannot log food for you');
select is(current_setting('test.c_update_alice'), '0', 'another adult cannot change your Calorie Log');
select is(current_setting('test.c_alice_cal_shared'), '2', 'once you share everything, another adult reads your Calorie Log');
select is(current_setting('test.c_alice_settings_shared'), '1', 'once you share everything, another adult reads your Targets');
select is(current_setting('test.c_alice_weight_shared'), '1', 'once you share everything, another adult reads your weight');
select is(current_setting('test.c_update_alice_shared'), '0', 'sharing everything does not let another adult change your Calorie Log');
select is(current_setting('test.b_alice_cal_shared'), '0', 'a Member of another Household never reads your Calorie Log');
select is(current_setting('test.b_alice_weight_shared'), '0', 'a Member of another Household never reads your weight');
select is(current_setting('test.b_alice_flags_shared'), '0', 'a Member of another Household never gets your flags');
select is(current_setting('test.c_alice_cal_off'), '0', 'turning sharing off hides your Calorie Log again');
select is(
  (select count(*)::text from public.members where share_everything and user_id = current_setting('test.alice')::uuid),
  '0',
  'Alice''s switch is off again, and Carl''s own switch did not change it'
);
select is(
  (select count(*)::text from public.members where share_everything and user_id = current_setting('test.carl')::uuid),
  '1',
  'Carl''s own switch is on'
);
select is(current_setting('test.anon_flags'), 'denied', 'an anonymous visitor cannot call the day flags');
select has_column('public', 'members', 'share_everything', 'members has the share_everything switch');
select has_function('public', 'set_share_everything', array['boolean'], 'the switch has its RPC');
select is(
  (select pg_get_function_result('public.member_day_flags(bigint,date,date)'::regprocedure)),
  'TABLE(day_key date, is_over boolean)',
  'the flags function returns only the day and the flag, no calories or Targets'
);

select * from finish();
rollback;
