-- Calorie Manager: Recipe star, Meal Time tags and copies (ticket #29)
--
-- 1. starred and copied_from already exist on recipes (001); nothing to add for them.
--    A copy keeps a link to its original through copied_from, which is set to null if the
--    original is deleted (the copy stays). Edits never cross: each copy has its own
--    recipe_ingredients rows, so changing one Recipe never touches the other.
-- 2. recipes.meal_time_tags (bigint[], 001) cannot hold a foreign key, so tags move to a
--    join table. The old column is left in place and unused (it was never read by the app).
-- 3. recipe_copy() copies a Recipe, its ingredients and its tags in one transaction.
--
-- Meal Times belong to a Member (migration 007), so a tag is visible to the Household only
-- where the Member's Meal Time is readable. The planner treats tags as a hint, not a rule.

-- 2. Meal Time tags -------------------------------------------------------------------
create table public.recipe_meal_time_tags (
  recipe_id bigint not null references public.recipes(id) on delete cascade,
  meal_time_id bigint not null references public.meal_times(id) on delete cascade,
  household_id bigint not null references public.households(id) on delete cascade,
  primary key (recipe_id, meal_time_id)
);
alter table public.recipe_meal_time_tags alter column household_id
  set default private.current_household_id();
create index recipe_meal_time_tags_household_idx on public.recipe_meal_time_tags (household_id);
create index recipe_meal_time_tags_meal_time_idx on public.recipe_meal_time_tags (meal_time_id);

-- A tag must name a Meal Time of a Member in the same Household as the Recipe.
create or replace function private.recipe_meal_time_tags_check()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.recipes r
    join public.meal_times mt on mt.id = new.meal_time_id
    join public.members mem on mem.id = mt.member_id
    where r.id = new.recipe_id
      and r.household_id = new.household_id
      and mem.household_id = new.household_id
  ) then
    raise exception 'Tag must name a Meal Time in the same Household' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.recipe_meal_time_tags_check() from public, anon, authenticated;

create trigger recipe_meal_time_tags_check
before insert or update on public.recipe_meal_time_tags
for each row execute function private.recipe_meal_time_tags_check();

-- Row-level security, as for the other Household tables (migration 006)
alter table public.recipe_meal_time_tags enable row level security;

create policy recipe_meal_time_tags_household_select on public.recipe_meal_time_tags
  for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy recipe_meal_time_tags_household_insert on public.recipe_meal_time_tags
  for insert to authenticated
  with check (household_id in (select private.my_household_ids()));
create policy recipe_meal_time_tags_household_update on public.recipe_meal_time_tags
  for update to authenticated
  using (household_id in (select private.my_household_ids()))
  with check (household_id in (select private.my_household_ids()));
create policy recipe_meal_time_tags_household_delete on public.recipe_meal_time_tags
  for delete to authenticated
  using (household_id in (select private.my_household_ids()));

grant select, insert, update, delete on public.recipe_meal_time_tags to authenticated;
revoke all on public.recipe_meal_time_tags from anon;

-- 3. recipe_copy: a full copy of a Recipe, made under the caller's row-level security -----
-- SECURITY INVOKER: a Recipe the caller cannot see is "not found", as for any read.
-- The copy is starred = false; its tags and ingredient lines are copied as they are.
create or replace function public.recipe_copy(p_recipe_id bigint, p_name text)
returns bigint
language plpgsql security invoker set search_path = ''
as $$
declare
  v_source public.recipes%rowtype;
  v_copy bigint;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'Give the copy a name' using errcode = '22023';
  end if;

  select * into v_source from public.recipes where id = p_recipe_id;
  if not found then
    raise exception 'Recipe not found' using errcode = 'P0002';
  end if;

  insert into public.recipes
    (name, starred, servings, cooked_weight_g, notes, copied_from, household_id)
  values
    (btrim(p_name), false, v_source.servings, v_source.cooked_weight_g, v_source.notes,
     v_source.id, v_source.household_id)
  returning id into v_copy;

  insert into public.recipe_ingredients
    (recipe_id, food_id, grams, amount_text, sort, household_id)
  select v_copy, ri.food_id, ri.grams, ri.amount_text, ri.sort, ri.household_id
  from public.recipe_ingredients ri
  where ri.recipe_id = v_source.id;

  insert into public.recipe_meal_time_tags (recipe_id, meal_time_id, household_id)
  select v_copy, t.meal_time_id, t.household_id
  from public.recipe_meal_time_tags t
  where t.recipe_id = v_source.id;

  return v_copy;
end $$;

revoke all on function public.recipe_copy(bigint, text) from public, anon;
grant execute on function public.recipe_copy(bigint, text) to authenticated;
