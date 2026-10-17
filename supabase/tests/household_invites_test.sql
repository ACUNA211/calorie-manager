-- Calorie Manager: tests for household invite links (ticket #06)
-- Run against a LOCAL stack only: `supabase start`, then `supabase test db`.
-- Alice owns one Household, Dave is a Member of it, Bob owns another, Carol has no
-- Household. Actions run as authenticated or anon and record their outcome in a setting,
-- which the assertions read back as the database owner.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

select set_config('test.alice', '11111111-1111-4111-8111-111111111111', true);
select set_config('test.bob', '22222222-2222-4222-8222-222222222222', true);
select set_config('test.carol', '33333333-3333-4333-8333-333333333333', true);
select set_config('test.dave', '44444444-4444-4444-8444-444444444444', true);

insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob@test.local'),
  (current_setting('test.carol')::uuid, 'authenticated', 'authenticated', 'carol@test.local'),
  (current_setting('test.dave')::uuid, 'authenticated', 'authenticated', 'dave@test.local');

-- Households: Alice and Bob create theirs; Dave joins Alice's as a Member
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Alice house', 'Alice'))::text, true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.bob_hh', (select public.create_household('Bob house', 'Bob'))::text, true);
insert into public.members (household_id, user_id, display_name, role)
  values (current_setting('test.alice_hh')::bigint, current_setting('test.dave')::uuid, 'Dave', 'member');

-- Alice (Owner) creates five links, as the app does
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
do $$
declare
  hh bigint := current_setting('test.alice_hh')::bigint;
  t text;
begin
  insert into public.household_invites (household_id) values (hh) returning token into t;
  perform set_config('test.inv_valid', t, true);
  insert into public.household_invites (household_id) values (hh) returning token into t;
  perform set_config('test.inv_extra', t, true);
  insert into public.household_invites (household_id) values (hh) returning token into t;
  perform set_config('test.inv_expired', t, true);
  insert into public.household_invites (household_id) values (hh) returning token into t;
  perform set_config('test.inv_used', t, true);
  insert into public.household_invites (household_id) values (hh) returning token into t;
  perform set_config('test.inv_revoked', t, true);
end $$;
select set_config('test.a_count', (select count(*) from public.household_invites)::text, true);

-- Bob tries to create a link for Alice's Household
do $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
  insert into public.household_invites (household_id) values (current_setting('test.alice_hh')::bigint);
  perform set_config('test.bob_insert', 'ok', true);
exception when others then
  perform set_config('test.bob_insert', sqlstate, true);
end $$;

-- Dave (a Member, not the Owner) tries to create a link
do $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dave'), 'role', 'authenticated')::text, true);
  insert into public.household_invites (household_id) values (current_setting('test.alice_hh')::bigint);
  perform set_config('test.dave_insert', 'ok', true);
exception when others then
  perform set_config('test.dave_insert', sqlstate, true);
end $$;

-- Dave and Bob cannot list Alice's links
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dave'), 'role', 'authenticated')::text, true);
select set_config('test.dave_count', (select count(*) from public.household_invites)::text, true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.bob_count', (select count(*) from public.household_invites)::text, true);

-- Dave and Bob cannot revoke Alice's link
do $$
declare n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
  update public.household_invites set revoked_at = now() where token = current_setting('test.inv_valid');
  get diagnostics n = row_count;
  perform set_config('test.bob_revoke', n::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dave'), 'role', 'authenticated')::text, true);
  update public.household_invites set revoked_at = now() where token = current_setting('test.inv_valid');
  get diagnostics n = row_count;
  perform set_config('test.dave_revoke', n::text, true);
end $$;

-- Alice revokes her own link
do $$
declare n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
  update public.household_invites set revoked_at = now() where token = current_setting('test.inv_revoked');
  get diagnostics n = row_count;
  perform set_config('test.alice_revoke', n::text, true);
end $$;
reset role;

-- Time passes: one link expires, and one was already used (by Bob, as an earlier join)
update public.household_invites set expires_at = now() - interval '1 day'
  where token = current_setting('test.inv_expired');
update public.household_invites set used_by = current_setting('test.bob')::uuid, used_at = now()
  where token = current_setting('test.inv_used');

-- Landing screen: an anonymous visitor peeks at each kind of link
set local role anon;
select set_config('test.peek_valid', coalesce((select status from public.peek_invite(current_setting('test.inv_valid'))), 'none'), true);
select set_config('test.peek_name', coalesce((select household_name from public.peek_invite(current_setting('test.inv_valid'))), 'none'), true);
select set_config('test.peek_revoked', coalesce((select status from public.peek_invite(current_setting('test.inv_revoked'))), 'none'), true);
select set_config('test.peek_used', coalesce((select status from public.peek_invite(current_setting('test.inv_used'))), 'none'), true);
select set_config('test.peek_expired', coalesce((select status from public.peek_invite(current_setting('test.inv_expired'))), 'none'), true);
select set_config('test.peek_unknown', coalesce((select status from public.peek_invite('no-such-token')), 'none'), true);
reset role;

-- Accepting: Dave is already in a Household
do $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dave'), 'role', 'authenticated')::text, true);
  perform public.accept_invite(current_setting('test.inv_valid'));
  perform set_config('test.dave_accept', 'ok', true);
exception when others then
  perform set_config('test.dave_accept', sqlerrm, true);
end $$;

-- Accepting: Carol tries each unusable link, then a valid one
do $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('test.carol'), 'role', 'authenticated')::text, true);
  perform public.accept_invite(current_setting('test.inv_revoked'));
  perform set_config('test.carol_revoked', 'ok', true);
exception when others then
  perform set_config('test.carol_revoked', sqlerrm, true);
end $$;
do $$
begin
  perform public.accept_invite(current_setting('test.inv_expired'));
  perform set_config('test.carol_expired', 'ok', true);
exception when others then
  perform set_config('test.carol_expired', sqlerrm, true);
end $$;
do $$
begin
  perform public.accept_invite(current_setting('test.inv_used'));
  perform set_config('test.carol_used', 'ok', true);
exception when others then
  perform set_config('test.carol_used', sqlerrm, true);
end $$;
do $$
begin
  perform public.accept_invite('no-such-token');
  perform set_config('test.carol_unknown', 'ok', true);
exception when others then
  perform set_config('test.carol_unknown', sqlerrm, true);
end $$;
do $$
begin
  perform set_config('request.jwt.claims', '{}', true);
  perform public.accept_invite(current_setting('test.inv_valid'));
  perform set_config('test.noauth', 'ok', true);
exception when others then
  perform set_config('test.noauth', sqlstate, true);
end $$;

-- Carol joins with the valid link: one atomic step
do $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('test.carol'), 'role', 'authenticated')::text, true);
  perform set_config('test.carol_join', public.accept_invite(current_setting('test.inv_valid'), 'Carol')::text, true);
end $$;

-- Carol, now in a Household, cannot join a second one
do $$
begin
  perform public.accept_invite(current_setting('test.inv_extra'), 'Carol');
  perform set_config('test.carol_second', 'ok', true);
exception when others then
  perform set_config('test.carol_second', sqlerrm, true);
end $$;

-- Assertions (run as the database owner)
select is(current_setting('test.a_count'), '5', 'Alice, the Owner, creates and lists her five links');
select ok(
  (select expires_at - created_at = interval '7 days' from public.household_invites where token = current_setting('test.inv_valid')),
  'a new link expires 7 days after it is created'
);
select is(current_setting('test.bob_insert'), '42501', 'Bob cannot create a link for Alice''s Household');
select is(current_setting('test.dave_insert'), '42501', 'a Member cannot create a link');
select is(current_setting('test.dave_count'), '0', 'a Member cannot list the Household''s links');
select is(current_setting('test.bob_count'), '0', 'someone from another Household cannot list the links');
select is(current_setting('test.bob_revoke'), '0', 'Bob cannot revoke Alice''s link');
select is(current_setting('test.dave_revoke'), '0', 'a Member cannot revoke the Owner''s link');
select is(current_setting('test.alice_revoke'), '1', 'the Owner can revoke her own link');
select is(current_setting('test.peek_valid'), 'valid', 'a fresh link peeks as valid');
select is(current_setting('test.peek_name'), 'Alice house', 'a peek shows the Household name');
select is(current_setting('test.peek_revoked'), 'revoked', 'a revoked link peeks as revoked');
select is(current_setting('test.peek_used'), 'used', 'a used link peeks as used');
select is(current_setting('test.peek_expired'), 'expired', 'an expired link peeks as expired');
select is(current_setting('test.peek_unknown'), 'none', 'an unknown link peeks as nothing');
select is(current_setting('test.dave_accept'), 'already_in_household', 'a Member cannot join a second Household');
select is(current_setting('test.carol_revoked'), 'invite_revoked', 'a revoked link joins nobody');
select is(current_setting('test.carol_expired'), 'invite_expired', 'an expired link joins nobody');
select is(current_setting('test.carol_used'), 'invite_used', 'a used link joins nobody');
select is(current_setting('test.carol_unknown'), 'invite_not_found', 'an unknown link joins nobody');
select is(current_setting('test.noauth'), '28000', 'accepting a link needs a sign-in');
select is(
  current_setting('test.carol_join'),
  current_setting('test.alice_hh'),
  'a valid link returns the Household Carol joins'
);
select is(
  (select role from public.members where user_id = current_setting('test.carol')::uuid),
  'member',
  'the person who accepts joins as a Member'
);
select is(
  (select used_by::text from public.household_invites where token = current_setting('test.inv_valid')),
  current_setting('test.carol'),
  'the link records who used it'
);
select is(current_setting('test.carol_second'), 'already_in_household', 'a new Member cannot join a second Household');
select is(
  (select count(*)::text from public.members where user_id = current_setting('test.carol')::uuid),
  '1',
  'Carol has exactly one Member row'
);

select * from finish();
rollback;
