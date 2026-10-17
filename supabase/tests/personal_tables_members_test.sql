-- Calorie Manager: personal tables per Member (ticket #09)
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`.
-- Household Alice (Owner, with a Dependent, "Kid") and Household Bob (Owner). Each
-- signs in as authenticated and records outcomes in settings; assertions run as the
-- database owner. Rows are seeded as the database owner (bypassing RLS).
-- NOTE: the seed inserts into meal_plans, recipes and cooks. If 006 makes household_id
-- NOT NULL on those tables with no default, add it to these three inserts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

select set_config('test.alice', '33333333-3333-4333-8333-333333333333', true);
select set_config('test.bob', '44444444-4444-4444-8444-444444444444', true);

insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice9@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob9@test.local');

-- Each creates a Household through the RPC
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Alice house', 'Alice'))::text, true);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.bob_hh', (select public.create_household('Bob house', 'Bob'))::text, true);
reset role;

-- Members: Alice and Bob (Owners) plus Alice's Dependent (database owner adds it)
select set_config('test.alice_m', (select id::text from public.members where user_id = current_setting('test.alice')::uuid), true);
select set_config('test.bob_m', (select id::text from public.members where user_id = current_setting('test.bob')::uuid), true);
insert into public.members (household_id, user_id, display_name, role)
  values (current_setting('test.alice_hh')::bigint, null, 'Kid', 'dependent');
select set_config('test.kid_m', (select id::text from public.members where display_name = 'Kid'), true);

-- Meal Times: one each for Alice, Kid and Bob
insert into public.meal_times (member_id, name, time_of_day, kind) values
  (current_setting('test.alice_m')::bigint, 'Breakfast', '07:30', 'planned'),
  (current_setting('test.kid_m')::bigint, 'Lunch', '12:00', 'planned'),
  (current_setting('test.bob_m')::bigint, 'Breakfast', '07:30', 'planned');
-- Each Meal Time is shared only with its creator here (ticket 22 moved the range to this table)
insert into public.meal_time_members (meal_time_id, member_id, cal_min, cal_max)
  select id, member_id, 250, 450 from public.meal_times;
select set_config('test.alice_mt', (select id::text from public.meal_times where member_id = current_setting('test.alice_m')::bigint), true);
select set_config('test.kid_mt', (select id::text from public.meal_times where member_id = current_setting('test.kid_m')::bigint), true);
select set_config('test.bob_mt', (select id::text from public.meal_times where member_id = current_setting('test.bob_m')::bigint), true);

-- A Cook to hang Portions on (shared tables: see the NOTE above)
insert into public.meal_plans (week_start) values ('2026-10-18');
insert into public.recipes (name) values ('Test chili');
insert into public.cooks (meal_plan_id, recipe_id, cook_date, servings_made)
  select mp.id, r.id, '2026-10-18', 2
  from public.meal_plans mp, public.recipes r
  where mp.week_start = '2026-10-18' and r.name = 'Test chili';

-- Portions: Alice, Kid and Bob each at their own Meal Time on the same day
insert into public.portions (member_id, cook_id, meal_time_id, eat_date, servings) values
  (current_setting('test.alice_m')::bigint, (select id from public.cooks limit 1), current_setting('test.alice_mt')::bigint, '2026-10-18', 1),
  (current_setting('test.kid_m')::bigint, (select id from public.cooks limit 1), current_setting('test.kid_mt')::bigint, '2026-10-18', 1),
  (current_setting('test.bob_m')::bigint, (select id from public.cooks limit 1), current_setting('test.bob_mt')::bigint, '2026-10-18', 1);

-- Calorie Log: one entry each for Alice, Kid and Bob
insert into public.calorie_log (member_id, log_date, description, kcal) values
  (current_setting('test.alice_m')::bigint, '2026-10-18', 'Toast', 150),
  (current_setting('test.kid_m')::bigint, '2026-10-18', 'Juice', 90),
  (current_setting('test.bob_m')::bigint, '2026-10-18', 'Bob snack', 200);

-- Alice (Owner) as authenticated
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.a_mt_total', (select count(*) from public.meal_times)::text, true);
select set_config('test.a_mt_bob', (select count(*) from public.meal_times where member_id = current_setting('test.bob_m')::bigint)::text, true);
select set_config('test.a_portions_total', (select count(*) from public.portions)::text, true);
select set_config('test.a_portions_bob', (select count(*) from public.portions where member_id = current_setting('test.bob_m')::bigint)::text, true);
select set_config('test.a_cl_total', (select count(*) from public.calorie_log)::text, true);
select set_config('test.a_cl_bob', (select count(*) from public.calorie_log where member_id = current_setting('test.bob_m')::bigint)::text, true);
select set_config('test.a_settings_total', (select count(*) from public.member_settings)::text, true);
select set_config('test.a_settings_bob', (select count(*) from public.member_settings where member_id = current_setting('test.bob_m')::bigint)::text, true);
do $$
begin
  insert into public.calorie_log (member_id, log_date, description, kcal)
    values (current_setting('test.kid_m')::bigint, '2026-10-18', 'Kid lunch logged by Alice', 300);
  perform set_config('test.a_log_kid', 'ok', true);
exception when others then
  perform set_config('test.a_log_kid', sqlstate, true);
end $$;
do $$
begin
  insert into public.calorie_log (member_id, log_date, description, kcal)
    values (current_setting('test.bob_m')::bigint, '2026-10-18', 'Sneaky', 100);
  perform set_config('test.a_log_bob', 'ok', true);
exception when others then
  perform set_config('test.a_log_bob', sqlstate, true);
end $$;
do $$
declare n int := -1;
begin
  update public.member_settings set calorie_target = 1 where member_id = current_setting('test.bob_m')::bigint;
  get diagnostics n = row_count;
  perform set_config('test.a_update_bob_settings', n::text, true);
end $$;
reset role;

-- Bob (Owner) as authenticated
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.b_mt_total', (select count(*) from public.meal_times)::text, true);
select set_config('test.b_portions_total', (select count(*) from public.portions)::text, true);
select set_config('test.b_portions_alice', (select count(*) from public.portions where member_id = current_setting('test.alice_m')::bigint)::text, true);
select set_config('test.b_cl_total', (select count(*) from public.calorie_log)::text, true);
select set_config('test.b_cl_alice', (select count(*) from public.calorie_log where member_id = current_setting('test.alice_m')::bigint)::text, true);
select set_config('test.b_settings_total', (select count(*) from public.member_settings)::text, true);
reset role;

-- Anonymous visitor
set local role anon;
do $$
declare n int;
begin
  select count(*) into n from public.calorie_log;
  perform set_config('test.anon_cl', n::text, true);
exception when insufficient_privilege then
  perform set_config('test.anon_cl', 'denied', true);
end $$;
reset role;

-- Assertions (database owner)

-- Backfill-free setup: every Member has one settings row with the default band
select is(
  (select count(*)::text from public.member_settings where member_id = current_setting('test.alice_m')::bigint),
  '1', 'the Owner has exactly one settings row'
);
select is(
  (select count(*)::text from public.member_settings where member_id = current_setting('test.kid_m')::bigint),
  '1', 'a Dependent gets its own settings row'
);
select is(
  (select band_low_pct || '-' || band_high_pct from public.member_settings where member_id = current_setting('test.alice_m')::bigint),
  '90-100', 'a new settings row keeps the default Planning band'
);
select is(
  (select calorie_target::text from public.member_settings where member_id = current_setting('test.alice_m')::bigint),
  null, 'a new settings row has no Calorie Target until one is set'
);
select throws_ok(
  $$insert into public.member_settings (member_id) values (current_setting('test.alice_m')::bigint)$$,
  '23505',
  null,
  'a Member cannot have a second settings row'
);
select throws_ok(
  $$insert into public.meal_times (name, time_of_day, kind)
    values ('No owner', '08:00', 'set')$$,
  '23502',
  null,
  'a Meal Time must have a Member'
);
select throws_ok(
  $$insert into public.calorie_log (log_date, description, kcal)
    values ('2026-10-18', 'No owner', 100)$$,
  '23502',
  null,
  'a Calorie Log entry must have a Member'
);

-- Alice sees her own rows and her Dependent's rows, not Bob's
select is(current_setting('test.a_mt_total'), '2', 'Alice sees her and Kid''s Meal Times');
select is(current_setting('test.a_mt_bob'), '0', 'Alice cannot see Bob''s Meal Times');
select is(current_setting('test.a_portions_total'), '2', 'Alice sees her and Kid''s Portions');
select is(current_setting('test.a_portions_bob'), '0', 'Alice cannot see Bob''s Portions');
select is(current_setting('test.a_cl_total'), '2', 'Alice sees her and Kid''s Calorie Log');
select is(current_setting('test.a_cl_bob'), '0', 'Alice cannot see Bob''s Calorie Log');
select is(current_setting('test.a_settings_total'), '2', 'Alice sees her and Kid''s settings rows');
select is(current_setting('test.a_settings_bob'), '0', 'Alice cannot see Bob''s settings row');
select is(current_setting('test.a_log_kid'), 'ok', 'Alice can log food for her Dependent');
select is(current_setting('test.a_log_bob'), '42501', 'Alice cannot log food for Bob');
select ok(current_setting('test.a_update_bob_settings') in ('0', '-2'), 'Alice cannot change Bob''s settings');
select is(
  (select calorie_target::text from public.member_settings where member_id = current_setting('test.bob_m')::bigint),
  null, 'Bob''s Calorie Target is unchanged by Alice'
);

-- Bob sees only his own rows
select is(current_setting('test.b_mt_total'), '1', 'Bob sees only his own Meal Times');
select is(current_setting('test.b_portions_total'), '1', 'Bob sees only his own Portions');
select is(current_setting('test.b_portions_alice'), '0', 'Bob cannot see Alice''s Portions');
select is(current_setting('test.b_cl_total'), '1', 'Bob sees only his own Calorie Log');
select is(current_setting('test.b_cl_alice'), '0', 'Bob cannot see Alice''s Calorie Log');
select is(current_setting('test.b_settings_total'), '1', 'Bob sees only his own settings row');

-- An anonymous visitor sees nothing
select ok(current_setting('test.anon_cl') in ('0', 'denied'), 'an anonymous visitor sees no Calorie Log');

-- Portions unique per (member, Meal Time, date)
select throws_ok(
  $$insert into public.portions (member_id, cook_id, meal_time_id, eat_date, servings)
    values (current_setting('test.alice_m')::bigint, (select id from public.cooks limit 1),
            current_setting('test.alice_mt')::bigint, '2026-10-18', 1)$$,
  '23505',
  null,
  'a Member cannot have two Portions at one Meal Time on one date'
);
select lives_ok(
  $$insert into public.portions (member_id, cook_id, meal_time_id, eat_date, servings)
    values (current_setting('test.kid_m')::bigint, (select id from public.cooks limit 1),
            current_setting('test.alice_mt')::bigint, '2026-10-19', 1)$$,
  'the key is per Member: another Member can use the same Meal Time on a different date'
);
select lives_ok(
  $$insert into public.portions (member_id, cook_id, meal_time_id, eat_date, servings)
    values (current_setting('test.bob_m')::bigint, (select id from public.cooks limit 1),
            current_setting('test.bob_mt')::bigint, '2026-10-19', 1)$$,
  'a Member can have a Portion on a new date'
);
select is(
  (select count(*)::text from public.portions where member_id = current_setting('test.alice_m')::bigint),
  '1', 'the seeded Owner Portion is still a single row'
);
select is(
  (select count(*)::text from public.portions where member_id = current_setting('test.kid_m')::bigint),
  '2', 'the Dependent has its two Portions'
);

select * from finish();
rollback;
