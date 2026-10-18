-- Calorie Manager: a new sharer sets their own calorie range (ticket #22, migration 033)
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`.
-- Alice (Owner) has Carla and Eve (adult Members) and Kid (a Dependent) in her Household.
-- Alice saves as herself; assertions run as the database owner.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select set_config('test.alice', '88888888-8888-4888-8888-888888888888', true);
select set_config('test.carla', '99999999-9999-4999-8999-999999999999', true);
select set_config('test.eve', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice-sr@test.local'),
  (current_setting('test.carla')::uuid, 'authenticated', 'authenticated', 'carla-sr@test.local'),
  (current_setting('test.eve')::uuid, 'authenticated', 'authenticated', 'eve-sr@test.local');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.hh', (select public.create_household('Sharer house', 'Alice'))::text, true);
reset role;

select set_config('test.alice_m', (select id::text from public.members where user_id = current_setting('test.alice')::uuid), true);
insert into public.members (household_id, user_id, display_name, role) values
  (current_setting('test.hh')::bigint, current_setting('test.carla')::uuid, 'Carla', 'member');
select set_config('test.carla_m', (select id::text from public.members where display_name = 'Carla'), true);
insert into public.members (household_id, user_id, display_name, role) values
  (current_setting('test.hh')::bigint, current_setting('test.eve')::uuid, 'Eve', 'member');
select set_config('test.eve_m', (select id::text from public.members where display_name = 'Eve'), true);
insert into public.members (household_id, user_id, display_name, role) values
  (current_setting('test.hh')::bigint, null, 'Kid', 'dependent');
select set_config('test.kid_m', (select id::text from public.members where display_name = 'Kid'), true);

-- 1. Alice creates "Lunch" for herself, Carla and Eve. Each new sharer gets their own range.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.mt', public.save_meal_time(
  current_setting('test.alice_m')::bigint, null, 'Lunch', '12:00', 'planned',
  array[1]::smallint[], 600, 800, null,
  array[current_setting('test.carla_m')::bigint, current_setting('test.eve_m')::bigint],
  jsonb_build_array(
    jsonb_build_object('member_id', current_setting('test.carla_m')::bigint, 'cal_min', 450, 'cal_max', 650, 'set_calories', null),
    jsonb_build_object('member_id', current_setting('test.eve_m')::bigint, 'cal_min', 300, 'cal_max', 500, 'set_calories', null)
  )
)::text, true);
reset role;
select set_config('test.alice_range_created', (select cal_min || '-' || cal_max from public.meal_time_members where meal_time_id = current_setting('test.mt')::bigint and member_id = current_setting('test.alice_m')::bigint), true);

-- 2. A new sharer without an entry of their own is refused
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
do $$
begin
  perform public.save_meal_time(
    current_setting('test.alice_m')::bigint, current_setting('test.mt')::bigint, 'Lunch', '12:00', 'planned',
    array[1]::smallint[], 700, 900, null,
    array[current_setting('test.carla_m')::bigint, current_setting('test.eve_m')::bigint, current_setting('test.kid_m')::bigint],
    jsonb_build_array(
      jsonb_build_object('member_id', current_setting('test.carla_m')::bigint, 'cal_min', 100, 'cal_max', 200, 'set_calories', null),
      jsonb_build_object('member_id', current_setting('test.eve_m')::bigint, 'cal_min', 100, 'cal_max', 200, 'set_calories', null)
    )
  );
  perform set_config('test.no_range', 'ok', true);
exception when others then
  perform set_config('test.no_range', sqlstate, true);
end $$;
reset role;

-- 3. The refused save changed nothing: Kid has no row
select set_config('test.kid_rows_after_refusal', (select count(*) from public.meal_time_members where meal_time_id = current_setting('test.mt')::bigint and member_id = current_setting('test.kid_m')::bigint)::text, true);

-- 4. Alice saves a new range. Carla and Eve already share the Meal Time, so their entries are
--    ignored: they keep their own ranges. Kid is a new sharer and gets his own range.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select public.save_meal_time(
  current_setting('test.alice_m')::bigint, current_setting('test.mt')::bigint, 'Lunch', '12:00', 'planned',
  array[1]::smallint[], 700, 900, null,
  array[current_setting('test.carla_m')::bigint, current_setting('test.eve_m')::bigint, current_setting('test.kid_m')::bigint],
  jsonb_build_array(
    jsonb_build_object('member_id', current_setting('test.carla_m')::bigint, 'cal_min', 100, 'cal_max', 200, 'set_calories', null),
    jsonb_build_object('member_id', current_setting('test.eve_m')::bigint, 'cal_min', 100, 'cal_max', 200, 'set_calories', null),
    jsonb_build_object('member_id', current_setting('test.kid_m')::bigint, 'cal_min', 250, 'cal_max', 350, 'set_calories', null)
  )
);
reset role;

-- Assertions (database owner)
select is(current_setting('test.alice_range_created'), '600-800', 'the editor''s own range is saved from the editor''s numbers');
select is(
  (select cal_min || '-' || cal_max from public.meal_time_members where meal_time_id = current_setting('test.mt')::bigint and member_id = current_setting('test.carla_m')::bigint),
  '450-650', 'a new sharer gets their own range'
);
select is(
  (select cal_min || '-' || cal_max from public.meal_time_members where meal_time_id = current_setting('test.mt')::bigint and member_id = current_setting('test.eve_m')::bigint),
  '300-500', 'a second new sharer gets their own, different range'
);
select is(current_setting('test.no_range'), '22023', 'a new sharer with no range of their own is refused');
select is(current_setting('test.kid_rows_after_refusal'), '0', 'a refused save adds no sharer row');
select is(
  (select cal_min || '-' || cal_max from public.meal_time_members where meal_time_id = current_setting('test.mt')::bigint and member_id = current_setting('test.carla_m')::bigint),
  '450-650', 'an existing sharer keeps their range when the editor saves a new one'
);
select is(
  (select cal_min || '-' || cal_max from public.meal_time_members where meal_time_id = current_setting('test.mt')::bigint and member_id = current_setting('test.alice_m')::bigint),
  '700-900', 'the editor''s own range is updated'
);
select is(
  (select cal_min || '-' || cal_max from public.meal_time_members where meal_time_id = current_setting('test.mt')::bigint and member_id = current_setting('test.kid_m')::bigint),
  '250-350', 'a sharer added later gets their own range, not the editor''s'
);

select * from finish();
rollback;
