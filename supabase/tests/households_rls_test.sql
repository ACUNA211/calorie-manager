-- Calorie Manager: RLS tests for Households and Members (ticket #05)
-- Run against a LOCAL stack only: `supabase start`, then `supabase test db`.
-- Two signed-in people (Alice, Bob) and one anonymous visitor. Each action runs as
-- the authenticated or anon role and records its outcome in a setting; the
-- assertions read those settings back as the database owner.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

select set_config('test.alice', '11111111-1111-4111-8111-111111111111', true);
select set_config('test.bob', '22222222-2222-4222-8222-222222222222', true);

insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob@test.local');

-- Alice and Bob each create a Household through the RPC
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Alice house', 'Alice'))::text, true);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.bob_hh', (select public.create_household('Bob house', 'Bob'))::text, true);
reset role;

-- Alice tries to read and write Bob's Household
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.a_hh_count', (select count(*) from public.households)::text, true);
select set_config('test.a_bob_hh_count', (select count(*) from public.households where id = current_setting('test.bob_hh')::bigint)::text, true);
select set_config('test.a_bob_members', (select count(*) from public.members where household_id = current_setting('test.bob_hh')::bigint)::text, true);
select set_config('test.a_members_total', (select count(*) from public.members)::text, true);
do $$
begin
  perform public.create_household('Alice again', 'Alice');
  perform set_config('test.a_second', 'ok', true);
exception when others then
  perform set_config('test.a_second', sqlstate, true);
end $$;
do $$
begin
  insert into public.members (household_id, user_id, display_name, role)
    values (current_setting('test.bob_hh')::bigint, null, 'Sneaky kid', 'dependent');
  perform set_config('test.a_insert', 'ok', true);
exception when others then
  perform set_config('test.a_insert', sqlstate, true);
end $$;
do $$
declare n int := -1;
begin
  begin
    update public.households set name = 'Hacked' where id = current_setting('test.bob_hh')::bigint;
    get diagnostics n = row_count;
  exception when insufficient_privilege then
    n := -2;
  end;
  perform set_config('test.a_update', n::text, true);
end $$;
do $$
declare n int := -1;
begin
  begin
    delete from public.members where household_id = current_setting('test.bob_hh')::bigint;
    get diagnostics n = row_count;
  exception when insufficient_privilege then
    n := -2;
  end;
  perform set_config('test.a_delete', n::text, true);
end $$;
reset role;

-- Bob sees only his own Household
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.b_hh_count', (select count(*) from public.households)::text, true);
select set_config('test.b_alice_hh_count', (select count(*) from public.households where id = current_setting('test.alice_hh')::bigint)::text, true);
select set_config('test.b_alice_members', (select count(*) from public.members where household_id = current_setting('test.alice_hh')::bigint)::text, true);
reset role;

-- An anonymous visitor sees nothing
set local role anon;
do $$
declare n int;
begin
  select count(*) into n from public.households;
  perform set_config('test.anon', n::text, true);
exception when insufficient_privilege then
  perform set_config('test.anon', 'denied', true);
end $$;
reset role;

-- Assertions (run as the database owner)
select ok(current_setting('test.alice_hh') <> '', 'Alice can create a Household');
select ok(current_setting('test.bob_hh') <> '', 'Bob can create a Household');
select is(
  (select role from public.members where user_id = current_setting('test.alice')::uuid),
  'owner',
  'the creator becomes the Owner'
);
select is(current_setting('test.a_hh_count'), '1', 'Alice sees only her own Household');
select is(current_setting('test.a_bob_hh_count'), '0', 'Alice cannot see Bob''s Household');
select is(current_setting('test.a_bob_members'), '0', 'Alice cannot see Bob''s Members');
select is(current_setting('test.a_members_total'), '1', 'Alice sees only her own Member row');
select is(current_setting('test.a_second'), 'P0001', 'Alice cannot create a second Household');
select is(current_setting('test.a_insert'), '42501', 'Alice cannot add a Member to Bob''s Household');
select ok(current_setting('test.a_update') in ('0', '-2'), 'Alice cannot rename Bob''s Household');
select is(
  (select name from public.households where id = current_setting('test.bob_hh')::bigint),
  'Bob house',
  'Bob''s Household name is unchanged'
);
select ok(current_setting('test.a_delete') in ('0', '-2'), 'Alice cannot delete Bob''s Members');
select is(
  (select count(*)::text from public.members where household_id = current_setting('test.bob_hh')::bigint),
  '1',
  'Bob''s Member row survives'
);
select is(current_setting('test.b_hh_count'), '1', 'Bob sees only his own Household');
select is(current_setting('test.b_alice_hh_count'), '0', 'Bob cannot see Alice''s Household');
select is(current_setting('test.b_alice_members'), '0', 'Bob cannot see Alice''s Members');
select ok(current_setting('test.anon') in ('0', 'denied'), 'an anonymous visitor sees no Households');

-- Constraints (database owner)
select throws_ok(
  $$insert into public.members (household_id, user_id, display_name, role)
    values (current_setting('test.bob_hh')::bigint, current_setting('test.alice')::uuid, 'Alice again', 'member')$$,
  '23505',
  null,
  'a user cannot belong to a second Household'
);
select throws_ok(
  $$insert into public.members (household_id, user_id, display_name, role)
    values (current_setting('test.bob_hh')::bigint, current_setting('test.bob')::uuid, 'Bob kid', 'dependent')$$,
  '23514',
  null,
  'a Dependent cannot have a login'
);
select throws_ok(
  $$insert into public.members (household_id, user_id, display_name, role)
    values (current_setting('test.bob_hh')::bigint, null, 'Ghost', 'member')$$,
  '23514',
  null,
  'a Member other than a Dependent needs a login'
);
select lives_ok(
  $$insert into public.members (household_id, user_id, display_name, role)
    values (current_setting('test.bob_hh')::bigint, null, 'Bob kid', 'dependent')$$,
  'a Dependent is added without a login'
);

select * from finish();
rollback;
