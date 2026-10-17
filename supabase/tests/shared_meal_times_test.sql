-- Calorie Manager: shared Meal Times (ticket #22)
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`.
-- Alice (Owner) has Dana (an adult Member with a login) and Kid (a Dependent) in her
-- Household. Bob (Owner) has his own Household. Writes go through save_meal_time() and the
-- direct policies, as the signed-in person; assertions run as the database owner.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

select set_config('test.alice', '55555555-5555-4555-8555-555555555555', true);
select set_config('test.bob', '66666666-6666-4666-8666-666666666666', true);
select set_config('test.dana', '77777777-7777-4777-8777-777777777777', true);

insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice22@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob22@test.local'),
  (current_setting('test.dana')::uuid, 'authenticated', 'authenticated', 'dana22@test.local');

-- Households, through the RPC as each Owner
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Alice house', 'Alice'))::text, true);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.bob_hh', (select public.create_household('Bob house', 'Bob'))::text, true);
reset role;

-- Members: Alice and Bob (Owners), Dana (adult, Alice's Household), Kid (Dependent, Alice's)
select set_config('test.alice_m', (select id::text from public.members where user_id = current_setting('test.alice')::uuid), true);
select set_config('test.bob_m', (select id::text from public.members where user_id = current_setting('test.bob')::uuid), true);
insert into public.members (household_id, user_id, display_name, role) values
  (current_setting('test.alice_hh')::bigint, current_setting('test.dana')::uuid, 'Dana', 'member');
select set_config('test.dana_m', (select id::text from public.members where display_name = 'Dana'), true);
insert into public.members (household_id, user_id, display_name, role)
  values (current_setting('test.alice_hh')::bigint, null, 'Kid', 'dependent');
select set_config('test.kid_m', (select id::text from public.members where display_name = 'Kid'), true);

-- Alice creates "Family dinner" for herself, Dana and Kid, with a range of 600 to 800
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.mt', public.save_meal_time(
  current_setting('test.alice_m')::bigint, null, 'Family dinner', '18:30', 'planned',
  array[1, 3]::smallint[], 600, 800, null,
  array[current_setting('test.dana_m')::bigint, current_setting('test.kid_m')::bigint]
)::text, true);
select set_config('test.a_sharers_created', (select count(*) from public.meal_time_members where meal_time_id = current_setting('test.mt')::bigint)::text, true);
select set_config('test.a_kid_range_created', (select cal_min || '-' || cal_max from public.meal_time_members where meal_time_id = current_setting('test.mt')::bigint and member_id = current_setting('test.kid_m')::bigint), true);
select set_config('test.a_alice_range_created', (select cal_min || '-' || cal_max from public.meal_time_members where meal_time_id = current_setting('test.mt')::bigint and member_id = current_setting('test.alice_m')::bigint), true);
reset role;

-- Dana sees the shared Meal Time and keeps her own range
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dana'), 'role', 'authenticated')::text, true);
select set_config('test.d_sees', (select count(*) from public.meal_times where id = current_setting('test.mt')::bigint)::text, true);
select set_config('test.d_save', public.save_meal_time(
  current_setting('test.dana_m')::bigint, current_setting('test.mt')::bigint, 'Family dinner', '18:30', 'planned',
  array[1, 3]::smallint[], 500, 700, null,
  array[current_setting('test.alice_m')::bigint, current_setting('test.kid_m')::bigint]
)::text, true);
reset role;

-- Dana's own range changed; Alice's and Kid's did not
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.a_alice_range_after_dana', (select cal_min || '-' || cal_max from public.meal_time_members where meal_time_id = current_setting('test.mt')::bigint and member_id = current_setting('test.alice_m')::bigint), true);
select set_config('test.a_kid_range_after_dana', (select cal_min || '-' || cal_max from public.meal_time_members where meal_time_id = current_setting('test.mt')::bigint and member_id = current_setting('test.kid_m')::bigint), true);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dana'), 'role', 'authenticated')::text, true);
select set_config('test.d_range_after_save', (select cal_min || '-' || cal_max from public.meal_time_members where meal_time_id = current_setting('test.mt')::bigint and member_id = current_setting('test.dana_m')::bigint), true);

-- Dana takes Kid off the Meal Time: Kid's row goes, the others stay as they were
select public.save_meal_time(
  current_setting('test.dana_m')::bigint, current_setting('test.mt')::bigint, 'Family dinner', '18:30', 'planned',
  array[1, 3]::smallint[], 500, 700, null,
  array[current_setting('test.alice_m')::bigint]
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.a_kid_rows_after_removal', (select count(*) from public.meal_time_members where meal_time_id = current_setting('test.mt')::bigint and member_id = current_setting('test.kid_m')::bigint)::text, true);
select set_config('test.a_alice_range_after_removal', (select cal_min || '-' || cal_max from public.meal_time_members where meal_time_id = current_setting('test.mt')::bigint and member_id = current_setting('test.alice_m')::bigint), true);
select set_config('test.a_sharers_after_removal', (select count(*) from public.meal_time_members where meal_time_id = current_setting('test.mt')::bigint)::text, true);
reset role;

-- Dana cannot share with Bob, who is in another Household
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dana'), 'role', 'authenticated')::text, true);
do $$
begin
  perform public.save_meal_time(
    current_setting('test.dana_m')::bigint, current_setting('test.mt')::bigint, 'Family dinner', '18:30', 'planned',
    array[1, 3]::smallint[], 500, 700, null,
    array[current_setting('test.bob_m')::bigint]
  );
  perform set_config('test.d_bob_sharer', 'ok', true);
exception when others then
  perform set_config('test.d_bob_sharer', sqlstate, true);
end $$;
reset role;

-- Bob sees nothing of Alice's, and cannot save to it
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.b_mt_total', (select count(*) from public.meal_times)::text, true);
do $$
begin
  perform public.save_meal_time(
    current_setting('test.bob_m')::bigint, current_setting('test.mt')::bigint, 'Sneaky', '18:30', 'planned',
    array[1]::smallint[], 100, 200, null, array[]::bigint[]
  );
  perform set_config('test.b_save', 'ok', true);
exception when others then
  perform set_config('test.b_save', sqlstate, true);
end $$;
reset role;

-- Dana leaves the Meal Time: her own row goes, and she no longer sees it
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dana'), 'role', 'authenticated')::text, true);
do $$
declare n int := -1;
begin
  delete from public.meal_time_members
   where meal_time_id = current_setting('test.mt')::bigint and member_id = current_setting('test.dana_m')::bigint;
  get diagnostics n = row_count;
  perform set_config('test.d_leave_rows', n::text, true);
end $$;
select set_config('test.d_sees_after_leave', (select count(*) from public.meal_times where id = current_setting('test.mt')::bigint)::text, true);
reset role;

-- The creator cannot leave her own Meal Time (the policy blocks the delete)
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
do $$
declare n int := -1;
begin
  delete from public.meal_time_members
   where meal_time_id = current_setting('test.mt')::bigint and member_id = current_setting('test.alice_m')::bigint;
  get diagnostics n = row_count;
  perform set_config('test.a_leave_rows', n::text, true);
end $$;

-- Saving with no extra sharers keeps the creator in, and bad input is refused
select public.save_meal_time(
  current_setting('test.alice_m')::bigint, current_setting('test.mt')::bigint, 'Family dinner', '18:30', 'planned',
  array[1, 3]::smallint[], 600, 800, null, array[]::bigint[]
);
select set_config('test.a_sharers_after_empty', (select count(*) from public.meal_time_members where meal_time_id = current_setting('test.mt')::bigint)::text, true);
do $$
begin
  perform public.save_meal_time(
    current_setting('test.alice_m')::bigint, current_setting('test.mt')::bigint, 'Family dinner', '18:30', 'bogus',
    array[1]::smallint[], 600, 800, null, array[]::bigint[]
  );
  perform set_config('test.a_bad_kind', 'ok', true);
exception when others then
  perform set_config('test.a_bad_kind', sqlstate, true);
end $$;
do $$
begin
  perform public.save_meal_time(
    current_setting('test.alice_m')::bigint, current_setting('test.mt')::bigint, 'Family dinner', '18:30', 'planned',
    array[7]::smallint[], 600, 800, null, array[]::bigint[]
  );
  perform set_config('test.a_bad_weekday', 'ok', true);
exception when others then
  perform set_config('test.a_bad_weekday', sqlstate, true);
end $$;
do $$
begin
  perform public.save_meal_time(
    current_setting('test.alice_m')::bigint, current_setting('test.mt')::bigint, 'Family dinner', '18:30', 'planned',
    array[1]::smallint[], 900, 800, null, array[]::bigint[]
  );
  perform set_config('test.a_bad_range', 'ok', true);
exception when others then
  perform set_config('test.a_bad_range', sqlstate, true);
end $$;

-- Writes straight to the tables are refused: all changes go through the function or the leave policy
do $$
begin
  insert into public.meal_times (member_id, name, time_of_day, kind, weekdays)
    values (current_setting('test.alice_m')::bigint, 'Direct', '08:00', 'planned', array[1]::smallint[]);
  perform set_config('test.a_direct_meal', 'ok', true);
exception when others then
  perform set_config('test.a_direct_meal', sqlstate, true);
end $$;
do $$
begin
  insert into public.meal_time_members (meal_time_id, member_id, cal_min, cal_max)
    values (current_setting('test.mt')::bigint, current_setting('test.bob_m')::bigint, 100, 200);
  perform set_config('test.a_direct_sharer', 'ok', true);
exception when others then
  perform set_config('test.a_direct_sharer', sqlstate, true);
end $$;
reset role;

-- An anonymous visitor sees no shared Meal Times
set local role anon;
do $$
declare n int;
begin
  select count(*) into n from public.meal_times;
  perform set_config('test.anon_mt', n::text, true);
exception when insufficient_privilege then
  perform set_config('test.anon_mt', 'denied', true);
end $$;
reset role;

-- The creator deletes the Meal Time for everyone: the sharing rows go with it
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
delete from public.meal_times where id = current_setting('test.mt')::bigint;
reset role;

-- Assertions (database owner)
select is(current_setting('test.a_sharers_created'), '3', 'the creator, Dana and Kid share the new Meal Time');
select is(current_setting('test.a_alice_range_created'), '600-800', 'the creator''s range is saved');
select is(current_setting('test.a_kid_range_created'), '600-800', 'a new sharer starts with the same range');
select is(current_setting('test.d_sees'), '1', 'Dana sees the shared Meal Time');
select is(current_setting('test.d_range_after_save'), '500-700', 'Dana keeps her own range');
select is(current_setting('test.a_alice_range_after_dana'), '600-800', 'Dana''s edit leaves Alice''s range alone');
select is(current_setting('test.a_kid_range_after_dana'), '600-800', 'Dana''s edit leaves Kid''s range alone');
select is(current_setting('test.a_kid_rows_after_removal'), '0', 'taking Kid off removes only Kid''s row');
select is(current_setting('test.a_alice_range_after_removal'), '600-800', 'removing Kid leaves the others unchanged');
select is(current_setting('test.a_sharers_after_removal'), '2', 'two sharers remain after Kid is removed');
select is(current_setting('test.d_bob_sharer'), '42501', 'a sharer must be in the same Household');
select is(current_setting('test.b_mt_total'), '0', 'Bob sees none of Alice''s shared Meal Times');
select is(current_setting('test.b_save'), '42501', 'Bob cannot save to Alice''s Meal Time');
select is(current_setting('test.d_leave_rows'), '1', 'a sharer can leave, removing only her own row');
select is(current_setting('test.d_sees_after_leave'), '0', 'a Member who left no longer sees the Meal Time');
select is(current_setting('test.a_leave_rows'), '0', 'the creator cannot leave her own Meal Time');
select is(current_setting('test.a_sharers_after_empty'), '1', 'saving with no other sharers keeps the creator');
select is(current_setting('test.a_bad_kind'), '22023', 'an unknown kind is refused');
select is(current_setting('test.a_bad_weekday'), '22023', 'a weekday outside 0 to 6 is refused');
select is(current_setting('test.a_bad_range'), '23514', 'a minimum above the maximum is refused');
select is(current_setting('test.a_direct_meal'), '42501', 'a Meal Time cannot be inserted directly');
select is(current_setting('test.a_direct_sharer'), '42501', 'a sharing row cannot be inserted directly');
select ok(current_setting('test.anon_mt') in ('0', 'denied'), 'an anonymous visitor sees no shared Meal Times');
select is(
  (select count(*)::text from public.meal_time_members where meal_time_id = current_setting('test.mt')::bigint),
  '0', 'deleting the Meal Time removes its sharing rows'
);

select * from finish();
rollback;
