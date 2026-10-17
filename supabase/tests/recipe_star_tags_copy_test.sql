-- Calorie Manager: Recipe Meal Time tags and copies (ticket #29, migration 016)
-- Run against a LOCAL stack only: `supabase start`, then `supabase test db`.
-- Two Households (Alice's and Bob's). Each adds a Meal Time of their own, then a Recipe.
-- Assertions that depend on row-level security run as the person; the rest run as the
-- database owner, reading back what the person wrote.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select set_config('test.alice', '11111111-1111-4111-8111-111111111111', true);
select set_config('test.bob', '22222222-2222-4222-8222-222222222222', true);

insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob@test.local');

-- Each Owner creates a Household (and so a Member for themselves)
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_hh', (select public.create_household('Alice house', 'Alice'))::text, true);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.bob_hh', (select public.create_household('Bob house', 'Bob'))::text, true);
reset role;

-- One Meal Time each, owned by each Member (set up as the owner, so RLS does not get in the way)
insert into public.meal_times (member_id, name, time_of_day, kind, set_calories)
  select m.id, 'Alice breakfast', '07:30', 'set', 400
  from public.members m
  where m.user_id = current_setting('test.alice')::uuid;
insert into public.meal_times (member_id, name, time_of_day, kind, set_calories)
  select m.id, 'Bob breakfast', '07:30', 'set', 400
  from public.members m
  where m.user_id = current_setting('test.bob')::uuid;
select set_config('test.alice_mt', (select id::text from public.meal_times where name = 'Alice breakfast'), true);
select set_config('test.bob_mt', (select id::text from public.meal_times where name = 'Bob breakfast'), true);

-- A food in Alice's Household (as the owner)
insert into public.foods (name, source, kcal_per_100g, household_id)
  values ('Test rice', 'estimated', 130, current_setting('test.alice_hh')::bigint);

-- Alice stars a Recipe with one ingredient, then tags it with her own Meal Time
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
insert into public.recipes (name, starred, servings) values ('Alice bowl', true, 2);
insert into public.recipe_ingredients (recipe_id, food_id, grams)
  values ((select id from public.recipes where name = 'Alice bowl'),
          (select id from public.foods where name = 'Test rice'), 200);

do $$
begin
  insert into public.recipe_meal_time_tags (recipe_id, meal_time_id)
    values ((select id from public.recipes where name = 'Alice bowl'),
            current_setting('test.alice_mt')::bigint);
  perform set_config('test.tag_ok', 'ok', true);
exception when others then
  perform set_config('test.tag_ok', sqlstate, true);
end $$;

-- Alice tries to tag her Recipe with Bob's Meal Time; the trigger refuses it
do $$
begin
  insert into public.recipe_meal_time_tags (recipe_id, meal_time_id)
    values ((select id from public.recipes where name = 'Alice bowl'),
            current_setting('test.bob_mt')::bigint);
  perform set_config('test.tag_cross', 'ok', true);
exception when others then
  perform set_config('test.tag_cross', sqlstate, true);
end $$;

-- Alice copies her Recipe as a variation; the copy gets its own id
select set_config('test.copy_id',
  (select public.recipe_copy((select id from public.recipes where name = 'Alice bowl'),
                             'Alice bowl (variation)'))::text, true);

-- Alice tries to copy with a blank name
do $$
begin
  perform public.recipe_copy(current_setting('test.copy_id')::bigint, '   ');
  perform set_config('test.blank_copy', 'ok', true);
exception when others then
  perform set_config('test.blank_copy', sqlstate, true);
end $$;
reset role;

-- Bob reads and copies Alice's Recipe
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select set_config('test.bob_tags', (select count(*)::text from public.recipe_meal_time_tags), true);
do $$
begin
  perform public.recipe_copy((select id from public.recipes where name = 'Alice bowl'), 'Bob copy');
  perform set_config('test.bob_copy', 'ok', true);
exception when others then
  perform set_config('test.bob_copy', sqlstate, true);
end $$;
reset role;

-- Alice reads her tags (RLS: only her Household's rows)
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.alice_tags', (select count(*)::text from public.recipe_meal_time_tags), true);
reset role;

-- The copy: starred off, linked to the original, with the same ingredient line and tag
select is(current_setting('test.tag_ok'), 'ok', 'Alice can tag her Recipe with her own Meal Time');
select is(current_setting('test.tag_cross'), '23514', 'Alice cannot tag with a Meal Time from another Household');
select is(current_setting('test.bob_tags'), '0', 'Bob cannot see Alice''s Meal Time tags');
select is(current_setting('test.alice_tags'), '1', 'Alice sees her own Meal Time tag');
select ok(current_setting('test.copy_id')::bigint > 0, 'copying returns the new Recipe''s id');
select is(
  (select name from public.recipes where id = current_setting('test.copy_id')::bigint),
  'Alice bowl (variation)',
  'the copy has the name it was given'
);
select is(
  (select starred from public.recipes where id = current_setting('test.copy_id')::bigint),
  false,
  'the copy is not starred'
);
select is(
  (select copied_from from public.recipes where id = current_setting('test.copy_id')::bigint),
  (select id from public.recipes where name = 'Alice bowl'),
  'the copy names its original in copied_from'
);
select is(
  (select count(*)::text from public.recipe_ingredients
    where recipe_id = current_setting('test.copy_id')::bigint),
  '1',
  'the copy has the same ingredient lines as the original'
);
select is(
  (select grams::text from public.recipe_ingredients
    where recipe_id = current_setting('test.copy_id')::bigint),
  '200',
  'the copied ingredient keeps its grams'
);
select is(
  (select count(*)::text from public.recipe_meal_time_tags
    where recipe_id = current_setting('test.copy_id')::bigint),
  '1',
  'the copy keeps the original''s Meal Time tags'
);
select is(current_setting('test.bob_copy'), 'P0002', 'Bob cannot copy a Recipe from another Household');
select is(current_setting('test.blank_copy'), '22023', 'a copy needs a name');

-- Editing the copy leaves the original alone
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
update public.recipes set name = 'Copy renamed' where id = current_setting('test.copy_id')::bigint;
update public.recipe_ingredients set grams = 50 where recipe_id = current_setting('test.copy_id')::bigint;
reset role;

select is(
  (select name from public.recipes where name = 'Alice bowl'),
  'Alice bowl',
  'renaming the copy does not rename the original'
);
select is(
  (select grams::text from public.recipe_ingredients ri
    join public.recipes r on r.id = ri.recipe_id where r.name = 'Alice bowl'),
  '200',
  'changing the copy''s grams does not change the original'
);

-- Deleting the original keeps the copy, and the copy loses only its link
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
delete from public.recipes where name = 'Alice bowl';
reset role;

select is(
  (select count(*)::text from public.recipes where id = current_setting('test.copy_id')::bigint),
  '1',
  'deleting the original does not delete the copy'
);
select ok(
  (select copied_from is null from public.recipes where id = current_setting('test.copy_id')::bigint),
  'the copy''s link to a deleted original is cleared'
);
select is(
  (select count(*)::text from public.recipe_meal_time_tags
    where recipe_id = current_setting('test.copy_id')::bigint),
  '1',
  'the copy keeps its own Meal Time tag after the original is deleted'
);

select * from finish();
rollback;
