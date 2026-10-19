-- Calorie Manager: Hard-rule filter (ticket #38)
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`.
-- Household Alice: Owner Alice (no Hard rules, no preferences row) and six Dependents, each with
-- one kind of rule: Veg (vegetarian), Halal (halal), Nut (peanut group), Tom (will not eat
-- "Tomato"), Kos (kosher), Dai (dairy group). Household Bob: Owner Bob.
-- Calls run as authenticated and record their result in a setting; assertions run as the
-- database owner.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

select set_config('test.alice', '55555555-5555-4555-8555-555555555538', true);
select set_config('test.bob', '66666666-6666-4666-8666-666666666638', true);
insert into auth.users (id, aud, role, email) values
  (current_setting('test.alice')::uuid, 'authenticated', 'authenticated', 'alice38@test.local'),
  (current_setting('test.bob')::uuid, 'authenticated', 'authenticated', 'bob38@test.local');

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
insert into public.members (household_id, user_id, display_name, role) values
  (current_setting('test.alice_hh')::bigint, null, 'Veg', 'dependent'),
  (current_setting('test.alice_hh')::bigint, null, 'Halal', 'dependent'),
  (current_setting('test.alice_hh')::bigint, null, 'Nut', 'dependent'),
  (current_setting('test.alice_hh')::bigint, null, 'Tom', 'dependent'),
  (current_setting('test.alice_hh')::bigint, null, 'Kos', 'dependent'),
  (current_setting('test.alice_hh')::bigint, null, 'Dai', 'dependent');
select set_config('test.veg_m', (select id::text from public.members where display_name = 'Veg'), true);
select set_config('test.halal_m', (select id::text from public.members where display_name = 'Halal'), true);
select set_config('test.nut_m', (select id::text from public.members where display_name = 'Nut'), true);
select set_config('test.tom_m', (select id::text from public.members where display_name = 'Tom'), true);
select set_config('test.kos_m', (select id::text from public.members where display_name = 'Kos'), true);
select set_config('test.dai_m', (select id::text from public.members where display_name = 'Dai'), true);

-- Hard rules (Alice has no preferences row at all)
insert into public.member_preferences (member_id, hard_diets) values (current_setting('test.veg_m')::bigint, '{vegetarian}');
insert into public.member_preferences (member_id, hard_diets) values (current_setting('test.halal_m')::bigint, '{halal}');
insert into public.member_preferences (member_id, hard_food_groups) values (current_setting('test.nut_m')::bigint, '{peanuts}');
insert into public.member_preferences (member_id, hard_foods) values (current_setting('test.tom_m')::bigint, '{Tomato}');
insert into public.member_preferences (member_id, hard_diets) values (current_setting('test.kos_m')::bigint, '{kosher}');
insert into public.member_preferences (member_id, hard_food_groups) values (current_setting('test.dai_m')::bigint, '{dairy}');

-- Foods and Recipes of Household Alice, named the way USDA names them
insert into public.foods (name, source, kcal_per_100g, household_id, usda_category) values
  ('Rice, white, cooked', 'estimated', 100, current_setting('test.alice_hh')::bigint, null),
  ('Tomatoes, red, raw', 'estimated', 100, current_setting('test.alice_hh')::bigint, null),
  ('Lentils, cooked', 'estimated', 100, current_setting('test.alice_hh')::bigint, null),
  ('Peanut butter, smooth', 'estimated', 100, current_setting('test.alice_hh')::bigint, null),
  ('Wheat flour, white', 'estimated', 100, current_setting('test.alice_hh')::bigint, null),
  ('Chicken, breast, raw', 'estimated', 100, current_setting('test.alice_hh')::bigint, null),
  ('Pork sausage, cooked', 'estimated', 100, current_setting('test.alice_hh')::bigint, null),
  ('Milk, whole', 'estimated', 100, current_setting('test.alice_hh')::bigint, 'Dairy and Egg Products'),
  ('Cheese, cheddar', 'estimated', 100, current_setting('test.alice_hh')::bigint, null),
  ('Almond milk, unsweetened', 'estimated', 100, current_setting('test.alice_hh')::bigint, null),
  ('Salmon, Atlantic, raw', 'estimated', 100, current_setting('test.alice_hh')::bigint, null),
  ('Gelatin dessert, prepared', 'estimated', 100, current_setting('test.alice_hh')::bigint, null),
  ('Wine, red', 'estimated', 100, current_setting('test.alice_hh')::bigint, null),
  ('Beef, ground, raw', 'estimated', 100, current_setting('test.alice_hh')::bigint, null),
  ('Shrimp, cooked', 'estimated', 100, current_setting('test.alice_hh')::bigint, null),
  ('Egg, whole, raw', 'estimated', 100, current_setting('test.alice_hh')::bigint, null);
insert into public.recipes (name, servings, household_id) values
  ('Almond oats', 2, current_setting('test.alice_hh')::bigint),
  ('Chicken parmesan', 2, current_setting('test.alice_hh')::bigint),
  ('Chicken rice', 2, current_setting('test.alice_hh')::bigint),
  ('Egg scramble', 2, current_setting('test.alice_hh')::bigint),
  ('Fish stew', 2, current_setting('test.alice_hh')::bigint),
  ('Gummy dessert', 2, current_setting('test.alice_hh')::bigint),
  ('Mac and cheese', 2, current_setting('test.alice_hh')::bigint),
  ('PB toast', 2, current_setting('test.alice_hh')::bigint),
  ('Plain empty', 2, current_setting('test.alice_hh')::bigint),
  ('Rice bowl', 2, current_setting('test.alice_hh')::bigint),
  ('Sausage pasta', 2, current_setting('test.alice_hh')::bigint),
  ('Shrimp rice', 2, current_setting('test.alice_hh')::bigint),
  ('Wine beef', 2, current_setting('test.alice_hh')::bigint);
insert into public.recipe_ingredients (recipe_id, food_id, grams, household_id)
  select r.id, f.id, 100, r.household_id
    from public.recipes r join public.foods f on (r.name, f.name) in (
    ('Rice bowl', 'Rice, white, cooked'),
    ('Rice bowl', 'Tomatoes, red, raw'),
    ('Rice bowl', 'Lentils, cooked'),
    ('PB toast', 'Peanut butter, smooth'),
    ('PB toast', 'Wheat flour, white'),
    ('Chicken rice', 'Chicken, breast, raw'),
    ('Chicken rice', 'Rice, white, cooked'),
    ('Sausage pasta', 'Pork sausage, cooked'),
    ('Sausage pasta', 'Wheat flour, white'),
    ('Mac and cheese', 'Milk, whole'),
    ('Mac and cheese', 'Wheat flour, white'),
    ('Mac and cheese', 'Cheese, cheddar'),
    ('Almond oats', 'Almond milk, unsweetened'),
    ('Almond oats', 'Rice, white, cooked'),
    ('Fish stew', 'Salmon, Atlantic, raw'),
    ('Fish stew', 'Tomatoes, red, raw'),
    ('Gummy dessert', 'Gelatin dessert, prepared'),
    ('Wine beef', 'Wine, red'),
    ('Wine beef', 'Beef, ground, raw'),
    ('Shrimp rice', 'Shrimp, cooked'),
    ('Shrimp rice', 'Rice, white, cooked'),
    ('Chicken parmesan', 'Chicken, breast, raw'),
    ('Chicken parmesan', 'Cheese, cheddar'),
    ('Egg scramble', 'Egg, whole, raw'),
    ('Egg scramble', 'Rice, white, cooked')
  );

-- Each scenario: the Recipe names allowed for those Members, asked by Alice
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.alice'), 'role', 'authenticated')::text, true);
select set_config('test.s_none', (select string_agg(r.name, ',' order by r.name) from public.allowed_recipes(array[current_setting('test.alice_m')::bigint]) a join public.recipes r on r.id = a.recipe_id), true);
select set_config('test.s_veg', (select string_agg(r.name, ',' order by r.name) from public.allowed_recipes(array[current_setting('test.veg_m')::bigint]) a join public.recipes r on r.id = a.recipe_id), true);
select set_config('test.s_halal', (select string_agg(r.name, ',' order by r.name) from public.allowed_recipes(array[current_setting('test.halal_m')::bigint]) a join public.recipes r on r.id = a.recipe_id), true);
select set_config('test.s_nut', (select string_agg(r.name, ',' order by r.name) from public.allowed_recipes(array[current_setting('test.nut_m')::bigint]) a join public.recipes r on r.id = a.recipe_id), true);
select set_config('test.s_tom', (select string_agg(r.name, ',' order by r.name) from public.allowed_recipes(array[current_setting('test.tom_m')::bigint]) a join public.recipes r on r.id = a.recipe_id), true);
select set_config('test.s_kos', (select string_agg(r.name, ',' order by r.name) from public.allowed_recipes(array[current_setting('test.kos_m')::bigint]) a join public.recipes r on r.id = a.recipe_id), true);
select set_config('test.s_dai', (select string_agg(r.name, ',' order by r.name) from public.allowed_recipes(array[current_setting('test.dai_m')::bigint]) a join public.recipes r on r.id = a.recipe_id), true);
select set_config('test.s_group', (select string_agg(r.name, ',' order by r.name) from public.allowed_recipes(array[current_setting('test.alice_m')::bigint,current_setting('test.nut_m')::bigint,current_setting('test.halal_m')::bigint]) a join public.recipes r on r.id = a.recipe_id), true);
select set_config('test.s_vegnut', (select string_agg(r.name, ',' order by r.name) from public.allowed_recipes(array[current_setting('test.veg_m')::bigint,current_setting('test.nut_m')::bigint]) a join public.recipes r on r.id = a.recipe_id), true);
select set_config('test.s_empty_set', (select count(*)::text from public.allowed_recipes('{}'::bigint[])), true);
select set_config('test.breaks_halal', (select string_agg(b.food_name || '=' || b.rule, ',' order by b.food_name) from public.hard_rule_breaks(array[current_setting('test.halal_m')::bigint]) b), true);
select set_config('test.breaks_tom', (select string_agg(distinct b.food_name || '=' || b.rule_kind, ',') from public.hard_rule_breaks(array[current_setting('test.tom_m')::bigint]) b), true);
select set_config('test.breaks_kos', (select string_agg(r.name || '=' || b.food_name, ',' order by r.name) from public.hard_rule_breaks(array[current_setting('test.kos_m')::bigint]) b join public.recipes r on r.id = b.recipe_id where b.rule = 'kosher' and b.food_id is null), true);
reset role;

-- Bob cannot filter with Alice's Members; an anonymous caller cannot call the functions
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.bob'), 'role', 'authenticated')::text, true);
select throws_ok(format('select * from public.allowed_recipes(array[%s]::bigint[])', current_setting('test.veg_m')), '42501', null, 'another Household''s Members are refused');
select throws_ok(format('select * from public.hard_rule_breaks(array[%s]::bigint[])', current_setting('test.veg_m')), '42501', null, 'another Household''s Members are refused for breaks too');
select set_config('test.bob_sees', (select count(*)::text from public.allowed_recipes(array[current_setting('test.bob_m')::bigint])), true);
reset role;

select is(current_setting('test.s_none'), 'Almond oats,Chicken parmesan,Chicken rice,Egg scramble,Fish stew,Gummy dessert,Mac and cheese,PB toast,Plain empty,Rice bowl,Sausage pasta,Shrimp rice,Wine beef', 'a Member with no Hard rules gets every Recipe');
select is(current_setting('test.s_veg'), 'Almond oats,Egg scramble,Mac and cheese,PB toast,Plain empty,Rice bowl', 'vegetarian: meat, fish, shellfish and gelatin Recipes are out; eggs, dairy and peanuts stay');
select is(current_setting('test.s_halal'), 'Almond oats,Chicken parmesan,Chicken rice,Egg scramble,Fish stew,Mac and cheese,PB toast,Plain empty,Rice bowl,Shrimp rice', 'halal: pork sausage, gelatin and wine are out; chicken, beef and fish stay');
select is(current_setting('test.s_nut'), 'Almond oats,Chicken parmesan,Chicken rice,Egg scramble,Fish stew,Gummy dessert,Mac and cheese,Plain empty,Rice bowl,Sausage pasta,Shrimp rice,Wine beef', 'a peanut allergy removes only the peanut butter Recipe (almond milk is not a peanut)');
select is(current_setting('test.s_tom'), 'Almond oats,Chicken parmesan,Chicken rice,Egg scramble,Gummy dessert,Mac and cheese,PB toast,Plain empty,Sausage pasta,Shrimp rice,Wine beef', 'a food someone will not eat (Tomato) matches Tomatoes, plural and case ignored');
select is(current_setting('test.s_kos'), 'Almond oats,Chicken rice,Egg scramble,Fish stew,Mac and cheese,PB toast,Plain empty,Rice bowl,Wine beef', 'kosher: pork, shellfish, gelatin and meat with dairy are out; beef and plain dairy stay');
select is(current_setting('test.s_dai'), 'Almond oats,Chicken rice,Egg scramble,Fish stew,Gummy dessert,PB toast,Plain empty,Rice bowl,Sausage pasta,Shrimp rice,Wine beef', 'a dairy group removes milk and cheese Recipes; almond milk is not dairy');
select is(current_setting('test.s_group'), 'Almond oats,Chicken parmesan,Chicken rice,Egg scramble,Fish stew,Mac and cheese,Plain empty,Rice bowl,Shrimp rice', 'one forbidden ingredient excludes the Recipe for the whole group, even for a Member with no rule on it');
select is(current_setting('test.s_vegnut'), 'Almond oats,Egg scramble,Mac and cheese,Plain empty,Rice bowl', 'two Members: vegetarian and peanut allergy together remove both sets');
select is(current_setting('test.s_empty_set')::int, 13, 'no Members given returns every Recipe of the Household');
select is(current_setting('test.breaks_halal'), 'Gelatin dessert, prepared=halal,Pork sausage, cooked=halal,Wine, red=halal', 'breaks name the ingredient and the rule');
select is(current_setting('test.breaks_tom'), 'Tomatoes, red, raw=food', 'a named food shows as a food break');
select is(current_setting('test.breaks_kos'), 'Chicken parmesan=meat with dairy', 'kosher meat with dairy is a Recipe-level break with no single ingredient');
select is(current_setting('test.bob_sees')::int, 0, 'Bob has no Recipes, so his list is empty');
select is((select count(*)::int from public.recipes where household_id = current_setting('test.alice_hh')::bigint), 13, 'the fixture holds 13 Recipes');
select ok(not has_function_privilege('anon', 'public.allowed_recipes(bigint[])', 'execute') and not has_function_privilege('anon', 'public.hard_rule_breaks(bigint[])', 'execute'), 'anon cannot call the filter');
select ok(not has_function_privilege('authenticated', 'private.food_tags(text,text,text)', 'execute'), 'clients cannot call the tagging internals');

select * from finish();
rollback;
