-- Calorie Manager: Dependents and "logging for" (ticket #07)
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`.
-- Ann (Owner, with Dependent "Kid"), Ben (an adult Member of Ann's Household, added by the
-- database owner), and Zed (Owner of another Household, with Dependent "Zed kid"). Each action
-- runs as authenticated and records its outcome in a setting; assertions run as the database owner.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

select set_config('test.ann', '55555555-5555-4555-8555-555555555555', true);
select set_config('test.ben', '66666666-6666-4666-8666-666666666666', true);
select set_config('test.zed', '77777777-7777-4777-8777-777777777777', true);

insert into auth.users (id, aud, role, email) values
  (current_setting('test.ann')::uuid, 'authenticated', 'authenticated', 'ann7@test.local'),
  (current_setting('test.ben')::uuid, 'authenticated', 'authenticated', 'ben7@test.local'),
  (current_setting('test.zed')::uuid, 'authenticated', 'authenticated', 'zed7@test.local');

-- Ann and Zed each create a Household (they are its Owners)
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.ann'), 'role', 'authenticated')::text, true);
select set_config('test.ann_hh', (select public.create_household('Ann house', 'Ann'))::text, true);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.zed'), 'role', 'authenticated')::text, true);
select set_config('test.zed_hh', (select public.create_household('Zed house', 'Zed'))::text, true);
reset role;

-- Ben is an adult Member of Ann's Household (the database owner adds him, as an invite would)
insert into public.members (household_id, user_id, display_name, role)
  values (current_setting('test.ann_hh')::bigint, current_setting('test.ben')::uuid, 'Ben', 'member');
select set_config('test.ben_m', (select id::text from public.members where user_id = current_setting('test.ben')::uuid), true);

-- Ann adds Kid, and renames them with padding that the function trims
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.ann'), 'role', 'authenticated')::text, true);
select set_config('test.kid_m', (select public.add_dependent('Kid'))::text, true);
do $$
begin
  perform public.add_dependent('   ');
  perform set_config('test.add_empty', 'ok', true);
exception when others then
  perform set_config('test.add_empty', sqlstate, true);
end $$;
do $$
begin
  perform public.add_dependent(repeat('k', 61));
  perform set_config('test.add_long', 'ok', true);
exception when others then
  perform set_config('test.add_long', sqlstate, true);
end $$;
select public.rename_dependent(current_setting('test.kid_m')::bigint, '  Kiddo  ');
reset role;

-- Zed adds a Dependent of his own
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.zed'), 'role', 'authenticated')::text, true);
select set_config('test.zkid_m', (select public.add_dependent('Zed kid'))::text, true);
reset role;

-- Ben (an adult, not the Owner) tries to add, rename and remove Dependents
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.ben'), 'role', 'authenticated')::text, true);
do $$
begin
  perform public.add_dependent('Ben kid');
  perform set_config('test.b_add', 'ok', true);
exception when others then
  perform set_config('test.b_add', sqlstate, true);
end $$;
do $$
begin
  perform public.rename_dependent(current_setting('test.kid_m')::bigint, 'Hacked');
  perform set_config('test.b_rename', 'ok', true);
exception when others then
  perform set_config('test.b_rename', sqlstate, true);
end $$;
do $$
begin
  perform public.remove_dependent(current_setting('test.kid_m')::bigint);
  perform set_config('test.b_remove', 'ok', true);
exception when others then
  perform set_config('test.b_remove', sqlstate, true);
end $$;
select set_config('test.b_sees_kid', (select count(*)::text from public.members where id = current_setting('test.kid_m')::bigint), true);
select set_config('test.b_dependents', (select count(*)::text from public.members where role = 'dependent'), true);
-- Ben logs food and sets Targets for Kid: any adult in the Household may do both
insert into public.calorie_log (member_id, log_date, description, kcal)
  values (current_setting('test.kid_m')::bigint, '2026-10-17', 'Kid snack', 150);
update public.member_settings set calorie_target = 1400 where member_id = current_setting('test.kid_m')::bigint;
select set_config('test.b_settings_kid', (select count(*)::text from public.member_settings where member_id = current_setting('test.kid_m')::bigint and calorie_target = 1400), true);
select set_config('test.b_log_kid_seen', (select count(*)::text from public.calorie_log where member_id = current_setting('test.kid_m')::bigint), true);
reset role;

-- Zed sees nothing of Ann's Household, and cannot touch Kid
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.zed'), 'role', 'authenticated')::text, true);
select set_config('test.z_sees_kid', (select count(*)::text from public.members where id = current_setting('test.kid_m')::bigint), true);
select set_config('test.z_sees_kid_log', (select count(*)::text from public.calorie_log where member_id = current_setting('test.kid_m')::bigint), true);
do $$
begin
  perform public.rename_dependent(current_setting('test.kid_m')::bigint, 'Zed was here');
  perform set_config('test.z_rename_kid', 'ok', true);
exception when others then
  perform set_config('test.z_rename_kid', sqlstate, true);
end $$;
do $$
begin
  insert into public.calorie_log (member_id, log_date, description, kcal)
    values (current_setting('test.kid_m')::bigint, '2026-10-17', 'Zed sneaks in', 99);
  perform set_config('test.z_log_kid', 'ok', true);
exception when others then
  perform set_config('test.z_log_kid', sqlstate, true);
end $$;
reset role;

-- Ann cannot rename Zed's Dependent, nor rename or remove Ben (an adult Member, not a Dependent)
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.ann'), 'role', 'authenticated')::text, true);
do $$
begin
  perform public.rename_dependent(current_setting('test.zkid_m')::bigint, 'Taken');
  perform set_config('test.a_rename_zkid', 'ok', true);
exception when others then
  perform set_config('test.a_rename_zkid', sqlstate, true);
end $$;
do $$
begin
  perform public.remove_dependent(current_setting('test.ben_m')::bigint);
  perform set_config('test.a_remove_ben', 'ok', true);
exception when others then
  perform set_config('test.a_remove_ben', sqlstate, true);
end $$;
do $$
begin
  perform public.rename_dependent(current_setting('test.ben_m')::bigint, 'Benny');
  perform set_config('test.a_rename_ben', 'ok', true);
exception when others then
  perform set_config('test.a_rename_ben', sqlstate, true);
end $$;
-- Ann removes Kid: the Dependent and their data go with them
select public.remove_dependent(current_setting('test.kid_m')::bigint);
reset role;

-- Assertions (database owner)
select is(current_setting('test.add_empty'), '23514', 'a Dependent needs a name');
select is(current_setting('test.add_long'), '22001', 'a Dependent name is at most 60 characters');
select is(current_setting('test.b_add'), '42501', 'an adult who is not the Owner cannot add a Dependent');
select is(current_setting('test.b_rename'), '42501', 'an adult who is not the Owner cannot rename a Dependent');
select is(current_setting('test.b_remove'), '42501', 'an adult who is not the Owner cannot remove a Dependent');
select is(current_setting('test.b_sees_kid'), '1', 'Ben sees Kid in the Household');
select is(current_setting('test.b_dependents'), '1', 'Ben sees the Household''s Dependents');
select is(current_setting('test.b_log_kid_seen'), '1', 'Ben can log food for Kid');
select is(current_setting('test.b_settings_kid'), '1', 'Ben can set Kid''s Targets');
select is(current_setting('test.z_sees_kid'), '0', 'Zed cannot see Ann''s Dependent');
select is(current_setting('test.z_sees_kid_log'), '0', 'Zed cannot see Kid''s Calorie Log');
select is(current_setting('test.z_rename_kid'), '42501', 'Zed cannot rename Ann''s Dependent');
select is(current_setting('test.z_log_kid'), '42501', 'Zed cannot log food for Ann''s Dependent');
select is(current_setting('test.a_rename_zkid'), '42501', 'Ann cannot rename Zed''s Dependent');
select is(current_setting('test.a_remove_ben'), '42501', 'Ann cannot remove an adult Member as a Dependent');
select is(current_setting('test.a_rename_ben'), '42501', 'Ann cannot rename an adult Member as a Dependent');
select is(
  (select display_name from public.members where id = current_setting('test.ben_m')::bigint),
  'Ben',
  'Ben''s name is unchanged'
);
select is(
  (select count(*)::text from public.members where id = current_setting('test.kid_m')::bigint),
  '0',
  'removing a Dependent deletes their Member row'
);
select is(
  (select count(*)::text from public.calorie_log where member_id = current_setting('test.kid_m')::bigint),
  '0',
  'removing a Dependent deletes their Calorie Log'
);
select is(
  (select count(*)::text from public.member_settings where member_id = current_setting('test.kid_m')::bigint),
  '0',
  'removing a Dependent deletes their Targets'
);
select is(
  (select count(*)::text from public.members where household_id = current_setting('test.ann_hh')::bigint),
  '2',
  'Ann''s Household keeps Ann and Ben'
);
select is(
  (select count(*)::text from public.members where id = current_setting('test.zkid_m')::bigint),
  '1',
  'Zed''s Dependent is untouched'
);
select throws_ok(
  $$insert into public.members (household_id, user_id, display_name, role)
    values (current_setting('test.ann_hh')::bigint, current_setting('test.zed')::uuid, 'Zed again', 'dependent')$$,
  '23514',
  null,
  'a Dependent can never have a login'
);
select is(
  (select count(*)::text from public.members where role = 'dependent' and household_id = current_setting('test.zed_hh')::bigint),
  '1',
  'Zed''s Household keeps its own Dependent only'
);

select * from finish();
rollback;
