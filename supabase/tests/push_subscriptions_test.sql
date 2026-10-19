-- Calorie Manager: Web Push subscriptions (ticket #54)
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`.
-- Alice and Bob each own a Household. Each action runs as authenticated and records its outcome in
-- a setting; assertions run as the database owner.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select set_config('test.alice', '55555555-5555-4555-8555-555555555054', true);
select set_config('test.bob', '66666666-6666-4666-8666-666666666054', true);

insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice54@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob54@test.local');

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

-- Alice saves a device, saves it again (same endpoint), and a second device
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select public.save_push_subscription('https://push.example/a-phone', 'key1', 'auth1', 'Phone');
select public.save_push_subscription('https://push.example/a-phone', 'key2', 'auth2', 'Phone');
select public.save_push_subscription('https://push.example/a-laptop', 'key3', 'auth3', 'Laptop');
select set_config('test.a_count', (select count(*) from public.push_subscriptions)::text, true);
select set_config('test.a_phone_key', (select p256dh from public.push_subscriptions where endpoint = 'https://push.example/a-phone'), true);
do $$ begin
  insert into public.push_subscriptions (member_id, endpoint, p256dh, auth)
    values (current_setting('test.alice_m')::bigint, 'https://push.example/direct', 'k', 'a');
  perform set_config('test.a_direct', 'ok', true);
exception when others then perform set_config('test.a_direct', sqlstate, true); end $$;
do $$ begin
  perform public.save_push_subscription('http://insecure.example/x', 'k', 'a');
  perform set_config('test.a_http', 'ok', true);
exception when others then perform set_config('test.a_http', sqlstate, true); end $$;
reset role;

-- Bob sees none of Alice's, cannot delete them, and takes over one endpoint by saving it himself
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.b_sees', (select count(*) from public.push_subscriptions)::text, true);
do $$ declare n int := -1; begin
  delete from public.push_subscriptions where endpoint = 'https://push.example/a-laptop';
  get diagnostics n = row_count; perform set_config('test.b_delete_other', n::text, true);
end $$;
select public.save_push_subscription('https://push.example/a-phone', 'key4', 'auth4', 'Shared phone');
select set_config('test.b_owns', (select count(*) from public.push_subscriptions where member_id = current_setting('test.bob_m')::bigint)::text, true);
reset role;

-- Alice removes her own remaining device
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.a_after_takeover', (select count(*) from public.push_subscriptions)::text, true);
do $$ declare n int := -1; begin
  delete from public.push_subscriptions where endpoint = 'https://push.example/a-laptop';
  get diagnostics n = row_count; perform set_config('test.a_delete_own', n::text, true);
end $$;
reset role;

-- A signed-out caller cannot save
set local role anon;
do $$ begin
  perform public.save_push_subscription('https://push.example/anon', 'k', 'a');
  perform set_config('test.anon_save', 'ok', true);
exception when others then perform set_config('test.anon_save', sqlstate, true); end $$;
reset role;

select is(current_setting('test.a_count'), '2', 'saving the same device twice keeps one row; two devices make two rows');
select is(current_setting('test.a_phone_key'), 'key2', 'saving again replaces the keys');
select is(current_setting('test.a_direct'), '42501', 'a Member cannot insert rows directly, only through save_push_subscription');
select is(current_setting('test.a_http'), '23514', 'a non-https endpoint is refused');
select is(current_setting('test.b_sees'), '0', 'another Member sees none of Alice''s subscriptions');
select is(current_setting('test.b_delete_other'), '0', 'another Member cannot delete Alice''s subscription');
select is(current_setting('test.b_owns'), '1', 'signing in on a device and allowing notifications moves that device to the new Member');
select is(current_setting('test.a_after_takeover'), '1', 'the first Member no longer owns the moved device');
select is(current_setting('test.a_delete_own'), '1', 'a Member deletes their own subscription');
select is(current_setting('test.anon_save'), '42501', 'a signed-out caller cannot save a subscription');
select ok(
  not has_table_privilege('anon', 'public.push_subscriptions', 'select')
  and (select relrowsecurity from pg_class where oid = 'public.push_subscriptions'::regclass),
  'anon has no access and row-level security is on'
);

select * from finish();
rollback;
