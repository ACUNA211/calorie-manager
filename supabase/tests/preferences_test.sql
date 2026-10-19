-- Calorie Manager: Preferences (ticket #37)
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`.
-- Household Alice: Owner, adult Carl, Dependent Kid. Household Bob: Owner.
-- Each action runs as authenticated and records its outcome in a setting; assertions run as
-- the database owner.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select set_config('test.alice', '55555555-5555-4555-8555-555555555537', true);
select set_config('test.bob', '66666666-6666-4666-8666-666666666637', true);
select set_config('test.carl', '77777777-7777-4777-8777-777777777737', true);

insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice37@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob37@test.local'),
  (current_setting('test.carl')::uuid, 'authenticated', 'authenticated', 'carl37@test.local');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Alice house', 'Alice'))::text, true);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.bob_hh', (select public.create_household('Bob house', 'Bob'))::text, true);
reset role;

select set_config('test.alice_m', (select id::text from public.members where user_id = current_setting('test.alice')::uuid), true);
select set_config('test.bob_m', (select id::text from public.members where user_id = current_setting('test.bob')::uuid), true);
insert into public.members (household_id, user_id, display_name, role) values
  (current_setting('test.alice_hh')::bigint, current_setting('test.carl')::uuid, 'Carl', 'member');
insert into public.members (household_id, user_id, display_name, role) values
  (current_setting('test.alice_hh')::bigint, null, 'Kid', 'dependent');
select set_config('test.carl_m', (select id::text from public.members where display_name = 'Carl'), true);
select set_config('test.kid_m', (select id::text from public.members where display_name = 'Kid'), true);

-- Seeded as the database owner: Bob's rows, and Alice's own Member Preferences
insert into public.household_preferences (household_id, cuisines) values (current_setting('test.bob_hh')::bigint, '{thai}');
insert into public.member_preferences (member_id, hard_diets) values (current_setting('test.bob_m')::bigint, '{halal}');
insert into public.member_preferences (member_id, hard_diets) values (current_setting('test.alice_m')::bigint, '{vegetarian}');

-- Carl (an adult Member) edits his Household's Preferences, his own, and the Dependent's
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.carl'), 'role', 'authenticated')::text, true);
do $$ begin
  insert into public.household_preferences (household_id, cuisines, weeknight_minutes, repeat_frequency)
    values (current_setting('test.alice_hh')::bigint, '{italian,mexican}', 30, 'sometimes');
  perform set_config('test.c_hh_insert', 'ok', true);
exception when others then perform set_config('test.c_hh_insert', sqlstate, true); end $$;
do $$ declare n int := -1; begin
  update public.household_preferences set budget_feel = 'tight' where household_id = current_setting('test.alice_hh')::bigint;
  get diagnostics n = row_count; perform set_config('test.c_hh_update', n::text, true);
end $$;
do $$ begin
  insert into public.household_preferences (household_id) values (current_setting('test.bob_hh')::bigint);
  perform set_config('test.c_hh_other', 'ok', true);
exception when others then perform set_config('test.c_hh_other', sqlstate, true); end $$;
do $$ declare n int := -1; begin
  update public.household_preferences set cuisines = '{x}' where household_id = current_setting('test.bob_hh')::bigint;
  get diagnostics n = row_count; perform set_config('test.c_hh_other_update', n::text, true);
end $$;
select set_config('test.c_hh_visible', (select count(*) from public.household_preferences)::text, true);
do $$ begin
  insert into public.member_preferences (member_id, favourites, hard_foods, hard_food_groups, hard_diets)
    values (current_setting('test.carl_m')::bigint, '{tacos}', '{cilantro}', '{shellfish}', '{halal}');
  perform set_config('test.c_own_insert', 'ok', true);
exception when others then perform set_config('test.c_own_insert', sqlstate, true); end $$;
do $$ begin
  insert into public.member_preferences (member_id, dislikes) values (current_setting('test.kid_m')::bigint, '{olives}');
  perform set_config('test.c_kid_insert', 'ok', true);
exception when others then perform set_config('test.c_kid_insert', sqlstate, true); end $$;
do $$ begin
  insert into public.member_preferences (member_id, dislikes) values (current_setting('test.bob_m')::bigint, '{x}');
  perform set_config('test.c_bob_insert', 'ok', true);
exception when others then perform set_config('test.c_bob_insert', sqlstate, true); end $$;
do $$ declare n int := -1; begin
  update public.member_preferences set hard_diets = '{vegan}' where member_id = current_setting('test.alice_m')::bigint;
  get diagnostics n = row_count; perform set_config('test.c_alice_update', n::text, true);
end $$;
select set_config('test.c_mp_visible', (select string_agg(member_id::text, ',' order by member_id) from public.member_preferences), true);
do $$ begin
  update public.member_preferences set hard_diets = '{keto}' where member_id = current_setting('test.carl_m')::bigint;
  perform set_config('test.c_bad_diet', 'ok', true);
exception when others then perform set_config('test.c_bad_diet', sqlstate, true); end $$;
do $$ begin
  update public.member_preferences set hard_food_groups = '{kryptonite}' where member_id = current_setting('test.carl_m')::bigint;
  perform set_config('test.c_bad_group', 'ok', true);
exception when others then perform set_config('test.c_bad_group', sqlstate, true); end $$;
reset role;

-- Alice (Owner) edits the Dependent's Preferences
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
do $$ declare n int := -1; begin
  update public.member_preferences set dislikes = '{olives,beets}' where member_id = current_setting('test.kid_m')::bigint;
  get diagnostics n = row_count; perform set_config('test.a_kid_update', n::text, true);
end $$;
select set_config('test.a_mp_visible', (select string_agg(member_id::text, ',' order by member_id) from public.member_preferences), true);
reset role;

select is(current_setting('test.c_hh_insert'), 'ok', 'a Member creates their Household''s Preferences');
select is(current_setting('test.c_hh_update'), '1', 'any Member edits their Household''s Preferences');
select is(current_setting('test.c_hh_other'), '42501', 'a Member cannot create another Household''s Preferences');
select is(current_setting('test.c_hh_other_update'), '0', 'a Member cannot change another Household''s Preferences');
select is(current_setting('test.c_hh_visible'), '1', 'a Member sees only their own Household''s Preferences');
select is(current_setting('test.c_own_insert'), 'ok', 'a Member saves their own Member Preferences');
select is(current_setting('test.c_kid_insert'), 'ok', 'an adult saves a Dependent''s Member Preferences');
select is(current_setting('test.c_bob_insert'), '42501', 'a Member cannot save another Household''s Member Preferences');
select is(current_setting('test.c_alice_update'), '0', 'an adult cannot change another adult''s Member Preferences');
select is(
  current_setting('test.c_mp_visible'),
  current_setting('test.carl_m') || ',' || current_setting('test.kid_m'),
  'an adult reads their own and the Dependent''s Member Preferences, not another adult''s'
);
select is(current_setting('test.c_bad_diet'), '23514', 'a diet rule outside the fixed list is refused');
select is(current_setting('test.c_bad_group'), '23514', 'a food group outside the fixed list is refused');
select is(current_setting('test.a_kid_update'), '1', 'the Owner edits the Dependent''s Member Preferences');
select is(
  current_setting('test.a_mp_visible'),
  current_setting('test.alice_m') || ',' || current_setting('test.kid_m'),
  'the Owner reads their own and the Dependent''s rows, not Carl''s'
);
select ok(
  not has_table_privilege('anon', 'public.household_preferences', 'select')
  and not has_table_privilege('anon', 'public.member_preferences', 'select'),
  'anon has no access to either Preferences table'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.member_preferences'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.household_preferences'::regclass),
  'row-level security is on for both Preferences tables'
);

select * from finish();
rollback;
