-- Calorie Manager: shared tables move into the Household (ticket #08)
-- Shared, per Household: foods, recipes, recipe_ingredients, meal_plans, cooks, grocery_list.
-- Personal, not touched here (ticket #09): member_settings, meal_times, portions, calorie_log.
--
-- BACKFILL RULE. None of the shared tables has a user column, so the Owner of the
-- existing project data is found in auth.users: the earliest-created login (several
-- logins raise a NOTICE). That person's Household is used if they already have one
-- (made with create_household); otherwise a Household is created with them as Owner,
-- named "Household". If there are shared rows but no login yet, a Household with no
-- Owner is created so no row is lost; an Owner must be attached to it later. If there
-- are no shared rows at all, nothing is created, so a fresh project can still create
-- its first Household.
--
-- FUNCTIONS. SECURITY INVOKER functions (shopping_measure, sync_shopping_list,
-- approve_meal_plan, cooks_sync_trigger) run under RLS, so the policies scope them.
-- sync_shopping_list also takes the Household from the plan it syncs. SECURITY DEFINER
-- functions (usda_save, usda_lookup_gtin) bypass RLS, so they filter by Household
-- explicitly through private.current_household_id(). usda_search and usda_get do not
-- touch these tables and are unchanged. CREATE OR REPLACE keeps existing grants.

-- 1. The Household for the current request ----------------------------------------
-- Signed-in user: their Member's Household (an error if they have none).
-- No signed-in user (direct connection or service role, as used by the Supabase
-- connector and the Agent): the only Household, if there is exactly one. With several
-- Households a service-role call must name one, so it fails rather than mixing data.
-- Anonymous and other roles never get a Household from this function.
create or replace function private.current_household_id()
returns bigint
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id bigint;
  v_count integer;
begin
  if v_uid is not null then
    select m.household_id into v_id from public.members m where m.user_id = v_uid;
    if v_id is null then
      raise exception 'Create or join a Household first' using errcode = '42501';
    end if;
    return v_id;
  end if;
  if auth.role() is not null and auth.role() <> 'service_role' then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  select count(*) into v_count from public.households;
  if v_count = 1 then
    select h.id into v_id from public.households h;
    return v_id;
  end if;
  raise exception 'Several or no Households: a signed-in user is needed' using errcode = '42501';
end $$;
revoke all on function private.current_household_id() from public, anon;
grant usage on schema private to service_role;
grant execute on function private.current_household_id() to authenticated, service_role;

-- 2. household_id columns (nullable until the backfill has run) -------------------
alter table public.foods add column household_id bigint references public.households(id) on delete cascade;
alter table public.recipes add column household_id bigint references public.households(id) on delete cascade;
alter table public.recipe_ingredients add column household_id bigint references public.households(id) on delete cascade;
alter table public.meal_plans add column household_id bigint references public.households(id) on delete cascade;
alter table public.cooks add column household_id bigint references public.households(id) on delete cascade;
alter table public.grocery_list add column household_id bigint references public.households(id) on delete cascade;

-- 3. Backfill the Owner's Household (rule in the header) --------------------------
do $$
declare
  v_owner uuid;
  v_household bigint;
  v_logins integer;
  v_has_rows boolean;
begin
  select exists (select 1 from public.foods)
      or exists (select 1 from public.recipes)
      or exists (select 1 from public.recipe_ingredients)
      or exists (select 1 from public.meal_plans)
      or exists (select 1 from public.cooks)
      or exists (select 1 from public.grocery_list)
    into v_has_rows;

  if v_has_rows then
    select count(*) into v_logins from auth.users;
    select u.id into v_owner from auth.users u order by u.created_at, u.id limit 1;
    if v_logins > 1 then
      raise notice 'Several logins exist; the existing data goes to the earliest-created one (%).', v_owner;
    end if;

    if v_owner is null then
      insert into public.households (name) values ('Household (existing data, no Owner yet)')
        returning id into v_household;
      raise notice 'No login yet: created a Household with no Owner (id %).', v_household;
    else
      select m.household_id into v_household from public.members m where m.user_id = v_owner;
      if v_household is null then
        insert into public.households (name) values ('Household') returning id into v_household;
        insert into public.members (household_id, user_id, display_name, role)
        select v_household, u.id,
               coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
                        nullif(trim(u.raw_user_meta_data->>'name'), ''),
                        nullif(split_part(u.email, '@', 1), ''),
                        'Owner'),
               'owner'
        from auth.users u where u.id = v_owner;
      end if;
    end if;

    update public.foods set household_id = v_household where household_id is null;
    update public.recipes set household_id = v_household where household_id is null;
    update public.recipe_ingredients set household_id = v_household where household_id is null;
    update public.meal_plans set household_id = v_household where household_id is null;
    update public.cooks set household_id = v_household where household_id is null;
    update public.grocery_list set household_id = v_household where household_id is null;
  end if;
end $$;

-- 4. NOT NULL, defaults and indexes -----------------------------------------------
-- The default lets existing app inserts keep working: the row takes the caller's Household.
alter table public.foods alter column household_id set not null;
alter table public.recipes alter column household_id set not null;
alter table public.recipe_ingredients alter column household_id set not null;
alter table public.meal_plans alter column household_id set not null;
alter table public.cooks alter column household_id set not null;
alter table public.grocery_list alter column household_id set not null;

alter table public.foods alter column household_id set default private.current_household_id();
alter table public.recipes alter column household_id set default private.current_household_id();
alter table public.recipe_ingredients alter column household_id set default private.current_household_id();
alter table public.meal_plans alter column household_id set default private.current_household_id();
alter table public.cooks alter column household_id set default private.current_household_id();
alter table public.grocery_list alter column household_id set default private.current_household_id();

create index foods_household_idx on public.foods (household_id);
create index recipes_household_idx on public.recipes (household_id);
create index recipe_ingredients_household_idx on public.recipe_ingredients (household_id);
create index meal_plans_household_idx on public.meal_plans (household_id);
create index cooks_household_idx on public.cooks (household_id);
create index grocery_list_household_idx on public.grocery_list (household_id);

-- Uniqueness is now per Household: two Households may both hold the same USDA food
-- or plan the same week.
drop index if exists public.foods_source_id_key;
create unique index foods_household_source_id_key on public.foods (household_id, source, source_id)
  where source_id is not null;
alter table public.meal_plans drop constraint if exists meal_plans_week_start_key;
alter table public.meal_plans add constraint meal_plans_household_week_start_key unique (household_id, week_start);

-- 5. Row-level security -----------------------------------------------------------
alter table public.foods enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.meal_plans enable row level security;
alter table public.cooks enable row level security;
alter table public.grocery_list enable row level security;

create policy foods_household_select on public.foods for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy foods_household_insert on public.foods for insert to authenticated
  with check (household_id in (select private.my_household_ids()));
create policy foods_household_update on public.foods for update to authenticated
  using (household_id in (select private.my_household_ids()))
  with check (household_id in (select private.my_household_ids()));
create policy foods_household_delete on public.foods for delete to authenticated
  using (household_id in (select private.my_household_ids()));

create policy recipes_household_select on public.recipes for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy recipes_household_insert on public.recipes for insert to authenticated
  with check (household_id in (select private.my_household_ids()));
create policy recipes_household_update on public.recipes for update to authenticated
  using (household_id in (select private.my_household_ids()))
  with check (household_id in (select private.my_household_ids()));
create policy recipes_household_delete on public.recipes for delete to authenticated
  using (household_id in (select private.my_household_ids()));

create policy recipe_ingredients_household_select on public.recipe_ingredients for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy recipe_ingredients_household_insert on public.recipe_ingredients for insert to authenticated
  with check (household_id in (select private.my_household_ids()));
create policy recipe_ingredients_household_update on public.recipe_ingredients for update to authenticated
  using (household_id in (select private.my_household_ids()))
  with check (household_id in (select private.my_household_ids()));
create policy recipe_ingredients_household_delete on public.recipe_ingredients for delete to authenticated
  using (household_id in (select private.my_household_ids()));

create policy meal_plans_household_select on public.meal_plans for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy meal_plans_household_insert on public.meal_plans for insert to authenticated
  with check (household_id in (select private.my_household_ids()));
create policy meal_plans_household_update on public.meal_plans for update to authenticated
  using (household_id in (select private.my_household_ids()))
  with check (household_id in (select private.my_household_ids()));
create policy meal_plans_household_delete on public.meal_plans for delete to authenticated
  using (household_id in (select private.my_household_ids()));

create policy cooks_household_select on public.cooks for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy cooks_household_insert on public.cooks for insert to authenticated
  with check (household_id in (select private.my_household_ids()));
create policy cooks_household_update on public.cooks for update to authenticated
  using (household_id in (select private.my_household_ids()))
  with check (household_id in (select private.my_household_ids()));
create policy cooks_household_delete on public.cooks for delete to authenticated
  using (household_id in (select private.my_household_ids()));

create policy grocery_list_household_select on public.grocery_list for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy grocery_list_household_insert on public.grocery_list for insert to authenticated
  with check (household_id in (select private.my_household_ids()));
create policy grocery_list_household_update on public.grocery_list for update to authenticated
  using (household_id in (select private.my_household_ids()))
  with check (household_id in (select private.my_household_ids()));
create policy grocery_list_household_delete on public.grocery_list for delete to authenticated
  using (household_id in (select private.my_household_ids()));

-- 6. Functions ---------------------------------------------------------------------

-- Invoker: the plan's Household is taken from the plan; new lines get it too.
create or replace function public.sync_shopping_list(p_plan_id bigint)
returns integer
language plpgsql set search_path = public as $$
declare
  r record;
  m record;
  v_household bigint;
  v_status text;
  added integer := 0;
begin
  -- A plan the caller cannot see (RLS) or that does not exist gives no status: nothing happens.
  select mp.household_id, mp.status into v_household, v_status
  from public.meal_plans mp where mp.id = p_plan_id;
  if v_status is distinct from 'approved' then
    return 0;
  end if;
  for r in
    with need as (
      select ri.food_id, sum(ri.grams * c.servings_made / rc.servings) as grams
      from public.cooks c
      join public.recipes rc on rc.id = c.recipe_id
      join public.recipe_ingredients ri on ri.recipe_id = c.recipe_id
      where c.meal_plan_id = p_plan_id and c.household_id = v_household
      group by ri.food_id
    ), covered as (
      select food_id, sum(grams) as grams
      from public.grocery_list
      where meal_plan_id = p_plan_id and source in ('plan','plan_extra')
        and household_id = v_household
      group by food_id
    )
    select n.food_id, n.grams - coalesce(cv.grams, 0) as short, cv.food_id is not null as had_line,
           f.name, f.store_section
    from need n
    join public.foods f on f.id = n.food_id and f.household_id = v_household
    left join covered cv on cv.food_id = n.food_id
    where n.grams - coalesce(cv.grams, 0) > 0.5
  loop
    select * into m from public.shopping_measure(r.food_id, r.short);
    insert into public.grocery_list (item_name, quantity_needed, purchased, food_id, meal_plan_id, source, grams, store_section, household_id)
    values (r.name, case when r.had_line then '+' else '' end || m.label, false,
            r.food_id, p_plan_id, case when r.had_line then 'plan_extra' else 'plan' end, m.grams, r.store_section,
            v_household);
    added := added + 1;
  end loop;
  return added;
end $$;

-- Security definer: bypasses RLS, so the Household is set and filtered explicitly.
create or replace function public.usda_save(p_fdc_id bigint)
returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hh bigint;
  existing bigint;
  f jsonb;
  kcal numeric;
  computed numeric;
  servings jsonb := '[]';
  cat text;
  new_id bigint;
begin
  v_hh := private.current_household_id();

  select id into existing from public.foods
  where household_id = v_hh and source = 'usda' and source_id = p_fdc_id::text;
  if existing is not null then return existing; end if;

  f := public.usda_get('food/' || p_fdc_id);
  kcal := public.usda_kcal(f);

  -- sanity check (#01): label typos happen; fall back to 4·carb + 4·protein + 9·fat
  select 4 * coalesce(max(a) filter (where id = 1003), 0)
       + 4 * coalesce(max(a) filter (where id = 1005), 0)
       + 9 * coalesce(max(a) filter (where id = 1004), 0)
    into computed
  from (select (n->'nutrient'->>'id')::int as id, (n->>'amount')::numeric as a
        from jsonb_array_elements(f->'foodNutrients') n) x;
  if kcal is null or (computed > 20 and abs(kcal - computed) / computed > 0.35) then
    kcal := computed;
  end if;
  if kcal is null then raise exception 'USDA food % has no calorie value', p_fdc_id; end if;

  if f->>'dataType' = 'Branded' then
    if upper(coalesce(f->>'servingSizeUnit','')) in ('G','GRM','ML','MLT') and (f->>'servingSize')::numeric > 0 then
      servings := jsonb_build_array(jsonb_build_object(
        'label', coalesce(nullif(f->>'householdServingFullText',''), '1 serving'),
        'grams', round((f->>'servingSize')::numeric, 1)));
    end if;
  else
    select coalesce(jsonb_agg(jsonb_build_object('label', lbl, 'grams', g)), '[]') into servings
    from (
      select distinct on (lbl) lbl, g from (
        select round((p->>'gramWeight')::numeric, 1) as g,
               trim(case when coalesce(p->>'portionDescription','') not in ('', 'Quantity not specified')
                         then p->>'portionDescription'
                         else coalesce(p->>'amount','1') || ' ' ||
                              coalesce(nullif(p->'measureUnit'->>'name', 'undetermined'), p->>'modifier', 'serving') end) as lbl
        from jsonb_array_elements(coalesce(f->'foodPortions', '[]')) p
        where (p->>'gramWeight')::numeric > 0
      ) s
    ) d;
  end if;

  cat := coalesce(f->>'brandedFoodCategory', f->'foodCategory'->>'description', f->>'foodCategory');

  insert into public.foods (name, brand, source, source_id, gtin, kcal_per_100g, servings, usda_category, store_section, household_id)
  values (f->>'description',
          coalesce(nullif(f->>'brandName',''), nullif(f->>'brandOwner','')),
          'usda', p_fdc_id::text, nullif(f->>'gtinUpc',''), round(kcal, 1), servings, cat, public.store_section_for(cat), v_hh)
  returning id into new_id;
  return new_id;
end $$;

-- Security definer: looks only in the caller's Household before asking USDA.
create or replace function public.usda_lookup_gtin(p_code text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  code text := ltrim(regexp_replace(p_code, '\D', '', 'g'), '0');
  v_hh bigint;
  j jsonb;
  local_id bigint;
begin
  if code = '' then return null; end if;
  v_hh := private.current_household_id();
  select id into local_id from public.foods
  where household_id = v_hh and ltrim(gtin, '0') = code limit 1;
  if local_id is not null then
    return jsonb_build_object('food_id', local_id);
  end if;
  j := public.usda_get('foods/search?pageSize=10&dataType=Branded&query=' || code);
  return (select public.usda_hit(f) from jsonb_array_elements(j->'foods') f
          where ltrim(f->>'gtinUpc', '0') = code
          order by f->>'publishedDate' desc nulls last limit 1);
end $$;
