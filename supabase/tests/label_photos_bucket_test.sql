-- Calorie Manager: label photos bucket (ticket #66)
-- Run against a LOCAL stack only: `supabase start`, then `supabase test db`. NOT RUN: no
-- local stack was started for this ticket; the database tests run in ticket #69.
-- The bucket is private. Alice adds a photo under her Household's folder and reads it back;
-- she cannot add one under Bob's folder; Bob cannot see Alice's photo or remove it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select set_config('test.alice', '11111111-1111-4111-8111-111111111111', true);
select set_config('test.bob', '22222222-2222-4222-8222-222222222222', true);
insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob@test.local');

select is(
  (select public from storage.buckets where id = 'label-photos'),
  false,
  'the label-photos bucket is private');
select is(
  (select file_size_limit from storage.buckets where id = 'label-photos'),
  5242880::bigint,
  'photos are limited to 5 MB');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Alice house', 'Alice'))::text, true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.bob_hh', (select public.create_household('Bob house', 'Bob'))::text, true);

-- Alice adds a photo to her Household's folder
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select lives_ok(
  format($f$insert into storage.objects (bucket_id, name, owner) values ('label-photos', '%s/one.jpg', %L)$f$,
    current_setting('test.alice_hh'), current_setting('test.alice')::uuid),
  'a Member can add a photo under their own Household folder');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'label-photos'),
  1,
  'the Member can read their Household photo back');

select throws_ok(
  format($f$insert into storage.objects (bucket_id, name, owner) values ('label-photos', '%s/two.jpg', %L)$f$,
    current_setting('test.bob_hh'), current_setting('test.alice')::uuid),
  '42501',
  null,
  'a Member cannot add a photo under another Household folder');
select throws_ok(
  $f$insert into storage.objects (bucket_id, name, owner) values ('label-photos', 'loose.jpg', null)$f$,
  '42501',
  null,
  'a photo outside any Household folder is refused');

-- Bob sees nothing of Alice's, and cannot remove it
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'label-photos'),
  0,
  'another Household sees no photos of ours');
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'label-photos';
reset role;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'label-photos'),
  1,
  'another Household cannot remove our photo');

-- Alice can remove her own
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'label-photos';
reset role;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'label-photos'),
  0,
  'a Member can remove their Household photo');

select * from finish();
rollback;
