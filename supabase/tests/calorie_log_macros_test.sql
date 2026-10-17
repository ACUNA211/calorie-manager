-- Calorie Manager: macros on the Calorie Log (ticket #23)
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`.
-- Alice (Owner) logs an entry for herself with macros, and one without (a USDA hit with no
-- figures). Macros must be nullable, never negative, and stored as given. Assertions run as
-- the database owner, as in shared_meal_times_test.sql.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- 1-3. Columns exist and are nullable
select col_is_null('public.calorie_log', 'protein_g', 'calorie_log.protein_g is nullable');
select col_is_null('public.calorie_log', 'carbs_g', 'calorie_log.carbs_g is nullable');
select col_is_null('public.calorie_log', 'fat_g', 'calorie_log.fat_g is nullable');

select set_config('test.alice', '88888888-8888-4888-8888-888888888888', true);
insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice23@test.local');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Today house', 'Alice'))::text, true);
reset role;
select set_config('test.alice_m', (select id::text from public.members where user_id = current_setting('test.alice')::uuid), true);

-- 4. An entry with macros is stored as given
insert into public.calorie_log (member_id, log_date, description, grams, kcal, protein_g, carbs_g, fat_g)
  values (current_setting('test.alice_m')::bigint, '2026-10-17', 'Oats', 40, 150, 5, 27, 3);
select is(
  (select protein_g from public.calorie_log where description = 'Oats'),
  5::numeric,
  'a logged entry keeps its protein'
);

-- 5. An entry with no macro figures stores NULL, not 0
insert into public.calorie_log (member_id, log_date, description, grams, kcal)
  values (current_setting('test.alice_m')::bigint, '2026-10-17', 'Mystery bar', 50, 200);
select is(
  (select carbs_g from public.calorie_log where description = 'Mystery bar'),
  null::numeric,
  'a missing carbs figure is NULL, never 0'
);

-- 6-8. Negative macros are refused
select throws_ok(
  $$insert into public.calorie_log (member_id, log_date, description, grams, kcal, protein_g)
    values ((select id from public.members where display_name = 'Alice'), '2026-10-17', 'Bad', 10, 10, -1)$$,
  '23514',
  null,
  'negative protein is refused'
);
select throws_ok(
  $$insert into public.calorie_log (member_id, log_date, description, grams, kcal, carbs_g)
    values ((select id from public.members where display_name = 'Alice'), '2026-10-17', 'Bad', 10, 10, -1)$$,
  '23514',
  null,
  'negative carbs are refused'
);
select throws_ok(
  $$insert into public.calorie_log (member_id, log_date, description, grams, kcal, fat_g)
    values ((select id from public.members where display_name = 'Alice'), '2026-10-17', 'Bad', 10, 10, -1)$$,
  '23514',
  null,
  'negative fat is refused'
);

-- 9. The entry's macros read back together
select results_eq(
  $$select protein_g, carbs_g, fat_g from public.calorie_log where description = 'Oats'$$,
  $$values (5::numeric, 27::numeric, 3::numeric)$$,
  'protein, carbs and fat are stored together'
);

select * from finish();
rollback;
