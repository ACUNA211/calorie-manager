-- Calorie Manager: Preferences (ticket #37)
-- What the Agent plans from (CONTEXT.md, Preferences).
--
-- household_preferences: one row per Household. Cuisines, weeknight and weekend cooking time
--   (minutes), equipment, how often meals repeat, how many leftovers are fine, a budget feel.
--   Shared: every Member of the Household reads and edits it (private.my_household_ids, 005).
-- member_preferences: one row per Member. Favourites and dislikes (soft), and Hard rules:
--   foods named by the Member, food groups and diet rules from the fixed lists below. Personal:
--   a Member reads and edits their own row, and every adult reads and edits a Dependent's
--   (private.my_member_ids, 007). Other adults see nothing here.
--
-- The fixed lists live in the check constraints and in web/src/lib/preferencesLogic.js; keep
-- them in step. Code (not the Agent) filters Recipes against Hard rules in a later ticket.
--
-- Run against a LOCAL stack only; the tests are supabase/tests/preferences_test.sql.

-- 1. Household Preferences -------------------------------------------------------
create table public.household_preferences (
  household_id bigint primary key references public.households(id) on delete cascade,
  cuisines text[] not null default '{}',
  weeknight_minutes integer check (weeknight_minutes between 5 and 480),
  weekend_minutes integer check (weekend_minutes between 5 and 480),
  equipment text[] not null default '{}'
    check (equipment <@ array['oven','stovetop','slow_cooker','pressure_cooker','air_fryer','microwave','grill','blender','rice_cooker']::text[]),
  repeat_frequency text check (repeat_frequency in ('rarely','sometimes','often')),
  leftovers_tolerance text check (leftovers_tolerance in ('none','some','plenty')),
  budget_feel text check (budget_feel in ('tight','moderate','relaxed')),
  updated_at timestamptz not null default now(),
  check (cardinality(cuisines) <= 50)
);

alter table public.household_preferences enable row level security;
revoke all on public.household_preferences from anon;
grant select, insert, update on public.household_preferences to authenticated;

create policy household_preferences_read on public.household_preferences
  for select to authenticated
  using (household_id in (select private.my_household_ids()));

create policy household_preferences_insert on public.household_preferences
  for insert to authenticated
  with check (household_id in (select private.my_household_ids()));

create policy household_preferences_update on public.household_preferences
  for update to authenticated
  using (household_id in (select private.my_household_ids()))
  with check (household_id in (select private.my_household_ids()));

-- 2. Member Preferences ----------------------------------------------------------
create table public.member_preferences (
  member_id bigint primary key references public.members(id) on delete cascade,
  favourites text[] not null default '{}',
  dislikes text[] not null default '{}',
  hard_foods text[] not null default '{}',
  hard_food_groups text[] not null default '{}'
    check (hard_food_groups <@ array['dairy','eggs','fish','shellfish','peanuts','tree_nuts','wheat_gluten','soy','sesame','pork','beef','poultry']::text[]),
  hard_diets text[] not null default '{}'
    check (hard_diets <@ array['vegetarian','vegan','pescatarian','halal','kosher','gluten_free','dairy_free']::text[]),
  updated_at timestamptz not null default now(),
  check (cardinality(favourites) <= 50 and cardinality(dislikes) <= 50 and cardinality(hard_foods) <= 50)
);

alter table public.member_preferences enable row level security;
revoke all on public.member_preferences from anon;
grant select, insert, update, delete on public.member_preferences to authenticated;

create policy member_preferences_read on public.member_preferences
  for select to authenticated
  using (member_id in (select private.my_member_ids()));

create policy member_preferences_insert on public.member_preferences
  for insert to authenticated
  with check (member_id in (select private.my_member_ids()));

create policy member_preferences_update on public.member_preferences
  for update to authenticated
  using (member_id in (select private.my_member_ids()))
  with check (member_id in (select private.my_member_ids()));

create policy member_preferences_delete on public.member_preferences
  for delete to authenticated
  using (member_id in (select private.my_member_ids()));
