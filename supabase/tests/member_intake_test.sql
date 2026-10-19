-- Calorie Manager: Intake form storage (ticket #64)
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`.
-- Household Alice: Owner, with an adult Member ("Carl") and a Dependent ("Kid").
-- Household Bob: Owner, in another Household. Rows are seeded as the database owner.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select set_config('test.alice', '88888888-8888-4888-8888-888888888864', true);
select set_config('test.bob', '99999999-9999-4999-8999-999999999964', true);
select set_config('test.carl', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa64', true);

insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice64@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob64@test.local'),
  (current_setting('test.carl')::uuid, 'authenticated', 'authenticated', 'carl64@test.local');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Alice house 64', 'Alice'))::text, true);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.bob_hh', (select public.create_household('Bob house 64', 'Bob'))::text, true);
reset role;

select set_config('test.alice_m', (select id::text from public.members where user_id = current_setting('test.alice')::uuid), true);
select set_config('test.bob_m', (select id::text from public.members where user_id = current_setting('test.bob')::uuid), true);
insert into public.members (household_id, user_id, display_name, role) values
  (current_setting('test.alice_hh')::bigint, current_setting('test.carl')::uuid, 'Carl', 'member');
insert into public.members (household_id, user_id, display_name, role) values
  (current_setting('test.alice_hh')::bigint, null, 'Kid', 'dependent');
select set_config('test.carl_m', (select id::text from public.members where user_id = current_setting('test.carl')::uuid), true);
select set_config('test.kid_m', (select id::text from public.members where display_name = 'Kid'), true);

-- 1. Defaults and checks (as the database owner) ----------------------------------
insert into public.member_intake (member_id) values (current_setting('test.alice_m')::bigint);
select is(
  (select floor_on from public.member_intake where member_id = current_setting('test.alice_m')::bigint),
  true,
  'the suggestion floor is on by default'
);
select is(
  (select floor_kcal from public.member_intake where member_id = current_setting('test.alice_m')::bigint),
  null,
  'no floor value means the default for the Member sex'
);

do $$
begin
  update public.member_intake set pace_kcal = 900 where member_id = current_setting('test.alice_m')::bigint;
  perform set_config('test.bad_pace', 'ok', true);
exception when others then
  perform set_config('test.bad_pace', sqlstate, true);
end $$;
select is(current_setting('test.bad_pace'), '23514', 'a pace beyond 750 kcal is refused');

do $$
begin
  update public.member_intake set sex = 'other' where member_id = current_setting('test.alice_m')::bigint;
  perform set_config('test.bad_sex', 'ok', true);
exception when others then
  perform set_config('test.bad_sex', sqlstate, true);
end $$;
select is(current_setting('test.bad_sex'), '23514', 'an unknown sex value is refused');

-- 2. Alice: her own row and her Dependent's -----------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
update public.member_intake set sex = 'female', height_cm = 165.5, floor_on = false
  where member_id = current_setting('test.alice_m')::bigint;
select is(
  (select height_cm from public.member_intake where member_id = current_setting('test.alice_m')::bigint),
  165.5,
  'a Member saves and reads her own answers'
);
insert into public.member_intake (member_id, sex) values (current_setting('test.kid_m')::bigint, 'male');
select is(
  (select count(*)::int from public.member_intake where member_id = current_setting('test.kid_m')::bigint),
  1,
  'an adult can write a Dependent row'
);

-- 3. Carl (another adult) cannot read Alice's body measurements ---------------------
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.carl'), 'role', 'authenticated')::text, true);
select is(
  (select count(*)::int from public.member_intake where member_id = current_setting('test.alice_m')::bigint),
  0,
  'another adult cannot read a Member intake row'
);
select is(
  (select count(*)::int from public.member_intake where member_id = current_setting('test.kid_m')::bigint),
  1,
  'another adult can read the Dependent row'
);

-- 4. Bob sees nothing of Alice's Household -------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select is(
  (select count(*)::int from public.member_intake where member_id in (current_setting('test.alice_m')::bigint, current_setting('test.kid_m')::bigint)),
  0,
  'a Member of another Household reads nothing'
);
do $$
begin
  insert into public.member_intake (member_id) values (current_setting('test.carl_m')::bigint);
  perform set_config('test.bob_ins', 'ok', true);
exception when others then
  perform set_config('test.bob_ins', sqlstate, true);
end $$;
select is(current_setting('test.bob_ins'), '42501', 'a Member of another Household cannot write a row for your Member');

-- 5. Anonymous visitors ---------------------------------------------------------------
set local role anon;
do $$
begin
  perform count(*) from public.member_intake;
  perform set_config('test.anon', 'ok', true);
exception when others then
  perform set_config('test.anon', sqlstate, true);
end $$;
select is(current_setting('test.anon'), '42501', 'an anonymous visitor cannot read the table');
reset role;

-- 6. Deleting the Member removes the row -----------------------------------------------
delete from public.members where id = current_setting('test.kid_m')::bigint;
select is(
  (select count(*)::int from public.member_intake where member_id = current_setting('test.kid_m')::bigint),
  0,
  'the row goes with its Member'
);

select * from finish();
rollback;
