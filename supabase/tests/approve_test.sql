-- Calorie Manager: Approve, migration 041 (ticket #45)
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`.
-- Alice (Owner) has Dana and Eve (Members) in her Household; Bob (Owner) has his own. Not run when written.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select set_config('test.alice', '99999999-9999-4999-8999-999999999951', true);
select set_config('test.bob', '99999999-9999-4999-8999-999999999952', true);
select set_config('test.dana', '99999999-9999-4999-8999-999999999953', true);
select set_config('test.eve', '99999999-9999-4999-8999-999999999954', true);
insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice45@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob45@test.local'),
  (current_setting('test.dana')::uuid, 'authenticated', 'authenticated', 'dana45@test.local'),
  (current_setting('test.eve')::uuid, 'authenticated', 'authenticated', 'eve45@test.local');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Alice house', 'Alice'))::text, true);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.bob_hh', (select public.create_household('Bob house', 'Bob'))::text, true);
reset role;

insert into public.members (household_id, user_id, display_name, role) values
  (current_setting('test.alice_hh')::bigint, current_setting('test.dana')::uuid, 'Dana', 'member'),
  (current_setting('test.alice_hh')::bigint, current_setting('test.eve')::uuid, 'Eve', 'member');
select set_config('test.dana_m', (select id::text from public.members where user_id = current_setting('test.dana')::uuid), true);
select set_config('test.eve_m', (select id::text from public.members where user_id = current_setting('test.eve')::uuid), true);
select set_config('test.bob_m', (select id::text from public.members where user_id = current_setting('test.bob')::uuid), true);

insert into public.meal_plans (household_id, week_start) values
  (current_setting('test.alice_hh')::bigint, '2026-10-18'),
  (current_setting('test.bob_hh')::bigint, '2026-10-18');
select set_config('test.plan', (select id::text from public.meal_plans where household_id = current_setting('test.alice_hh')::bigint), true);
select set_config('test.bob_plan', (select id::text from public.meal_plans where household_id = current_setting('test.bob_hh')::bigint), true);

-- Who may approve: the Owner always, Members only when allowed
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select is(public.plan_can_approve(), true, 'the Owner may approve');
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dana'), 'role', 'authenticated')::text, true);
select is(public.plan_can_approve(), false, 'a Member is not allowed by default');
select throws_ok(format('select public.plan_approve(%s)', current_setting('test.plan')), '42501', null, 'a Member who is not allowed cannot approve');
select throws_ok(format('select public.set_member_can_approve(%s, true)', current_setting('test.dana_m')), '42501', null, 'a Member cannot allow themselves');
reset role;
select is((select status from public.meal_plans where id = current_setting('test.plan')::bigint), 'draft', 'the plan is still a draft');

-- The Owner allows Dana but not Eve
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select lives_ok(format('select public.set_member_can_approve(%s, true)', current_setting('test.dana_m')), 'the Owner allows a Member');
select throws_ok(format('select public.set_member_can_approve(%s, true)', current_setting('test.bob_m')), '42501', null, 'the Owner cannot change a Member of another Household');
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.eve'), 'role', 'authenticated')::text, true);
select throws_ok(format('select public.plan_approve(%s)', current_setting('test.plan')), '42501', null, 'a Member who was not allowed still cannot approve');
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select throws_ok(format('select public.plan_approve(%s)', current_setting('test.plan')), '42501', null, 'the Owner of another Household cannot approve this plan');

-- An allowed Member approves
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dana'), 'role', 'authenticated')::text, true);
select is(public.plan_can_approve(), true, 'an allowed Member sees Approve');
select is((public.plan_approve(current_setting('test.plan')::bigint) ->> 'newly_approved')::boolean, true, 'an allowed Member approves a draft');
reset role;
select is((select status from public.meal_plans where id = current_setting('test.plan')::bigint), 'approved', 'the plan is approved');
select isnt((select approved_at from public.meal_plans where id = current_setting('test.plan')::bigint), null, 'approved_at is set');

-- Approving twice does nothing extra
create temp table t45_first as select approved_at from public.meal_plans where id = current_setting('test.plan')::bigint;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select is((public.plan_approve(current_setting('test.plan')::bigint) ->> 'newly_approved')::boolean, false, 'approving again is not a new approval');
reset role;
select is((select approved_at from public.meal_plans where id = current_setting('test.plan')::bigint), (select approved_at from t45_first), 'approved_at did not move');

-- Re-approving an edited plan clears the mark
update public.meal_plans set changed_since_approval = true where id = current_setting('test.plan')::bigint;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select lives_ok(format('select public.plan_approve(%s)', current_setting('test.plan')), 're-approving an edited plan works');
reset role;
select is((select changed_since_approval from public.meal_plans where id = current_setting('test.plan')::bigint), false, 're-approving clears changed_since_approval');

-- The old ungated entry point is shut
set local role authenticated;
select throws_ok(format('select public.approve_meal_plan(%s)', current_setting('test.bob_plan')), '42501', null, 'approve_meal_plan is no longer callable by clients');
reset role;

select * from finish();
rollback;
