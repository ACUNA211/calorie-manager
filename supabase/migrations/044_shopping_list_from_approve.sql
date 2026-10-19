-- Calorie Manager: the Shopping list from an approved Meal Plan, migration 044 (ticket #46)
-- CONTEXT.md "Shopping list": each line is what the Meal Plan needs minus what the Pantry holds,
-- in the unit stores sell in, and every Member of the Household sees the same list.
--
-- This adapts sync_shopping_list(plan_id) (002, moved to the Household in 006). plan_approve()
-- (041) still calls it at its "HOOK (46)" line, and so does the cooks trigger (002), so neither
-- needs to change.
--
--   * First sync of a food in a plan: the need is cut by what the Pantry holds. A food the Pantry
--     fully covers gets no line.
--   * Later syncs (the plan changed after approval): only the extra need becomes a new line,
--     marked source 'plan_extra'. Existing lines are never rewritten, reduced, unticked or removed.
--     The extra need first draws on Pantry that is still spare: the amount held, minus what an
--     earlier sync already counted on and minus the grams of this plan's lines already ticked
--     bought (those were bought for the plan's own need).
--   * The need already accounted for (Pantry credit plus lines) is kept in shopping_cover, one row
--     per plan and food, so nothing counts twice.
--   * Each line stores its amount in one shopping measure: a package (the food's package weight),
--     else its largest serving (a can, a bag), else steps of 50 g. The app words the line itself,
--     in the Member's language and units, from measure_kind, measure_label and measure_count.
--   * New lines are added in store-section order. Each line has its added date in created_at.
--
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`.
-- The test is supabase/tests/shopping_list_test.sql. Not run when written.

-- 1. Line columns --------------------------------------------------------------------
alter table public.grocery_list
  add column need_grams numeric,
  add column measure_kind text check (measure_kind in ('package', 'serving', 'weight')),
  add column measure_label text,
  add column measure_count integer check (measure_count is null or measure_count > 0);
comment on column public.grocery_list.need_grams is
  'The plan need this line covers, in grams (grams is the same amount rounded up to the shopping measure).';

-- 2. What each plan has already accounted for ------------------------------------------
create table public.shopping_cover (
  meal_plan_id bigint not null references public.meal_plans(id) on delete cascade,
  food_id bigint not null references public.foods(id) on delete cascade,
  household_id bigint not null references public.households(id) on delete cascade,
  grams numeric not null default 0,
  pantry_credit numeric not null default 0,
  primary key (meal_plan_id, food_id)
);
create index shopping_cover_household_idx on public.shopping_cover (household_id);
alter table public.shopping_cover enable row level security;
revoke all on public.shopping_cover from anon;
revoke insert, update, delete on public.shopping_cover from authenticated;
create policy shopping_cover_household_select on public.shopping_cover
  for select to authenticated
  using (household_id in (select private.my_household_ids()));

-- 3. The shopping measure -----------------------------------------------------------------
drop function if exists public.shopping_measure(bigint, numeric);
create function public.shopping_measure(p_food_id bigint, p_grams numeric)
returns table (kind text, label text, count integer, grams numeric, summary text)
language plpgsql stable set search_path = public as $$
declare
  f record;
  s jsonb;
begin
  select fd.package_grams, fd.servings into f from public.foods fd where fd.id = p_food_id;
  if f.package_grams is not null and f.package_grams > 0 then
    kind := 'package'; label := null; count := ceil(p_grams / f.package_grams)::integer;
    grams := count * f.package_grams;
    summary := count || ' × package (' || round(f.package_grams) || ' g)';
    return next;
    return;
  end if;
  select x into s
  from jsonb_array_elements(coalesce(f.servings, '[]'::jsonb)) x
  where (x->>'grams')::numeric > 0
  order by (x->>'grams')::numeric desc limit 1;
  if s is not null then
    kind := 'serving'; label := s->>'label'; count := ceil(p_grams / (s->>'grams')::numeric)::integer;
    grams := count * (s->>'grams')::numeric;
    summary := count || ' × ' || label || ' (' || round((s->>'grams')::numeric) || ' g)';
  else
    kind := 'weight'; label := null; grams := ceil(p_grams / 50) * 50; count := (grams / 50)::integer;
    summary := grams || ' g (' || round(grams / 453.6, 1) || ' lb)';
  end if;
  return next;
end $$;

-- 4. Build or top up the list for an approved plan ---------------------------------------
-- Security definer: it reads the Pantry and writes shopping_cover, which clients cannot write.
-- A signed-in caller must belong to the plan's Household; with no signed-in user (the database
-- itself, such as a test or a migration) it is allowed. Returns the number of lines added.
create or replace function public.sync_shopping_list(p_plan_id bigint)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  m record;
  v_household bigint;
  v_status text;
  v_cover numeric;
  v_credit numeric;
  v_short numeric;
  v_extra boolean;
  added integer := 0;
begin
  select mp.household_id, mp.status into v_household, v_status
    from public.meal_plans mp where mp.id = p_plan_id;
  if v_status is distinct from 'approved' then
    return 0;
  end if;
  if auth.uid() is not null and v_household not in (select private.my_household_ids()) then
    return 0;
  end if;
  -- two Members approving or editing at once take turns, so a shortfall is added once
  perform pg_advisory_xact_lock(7046, p_plan_id::integer);

  for r in
    with need as (
      select ri.food_id, sum(ri.grams * c.servings_made / rc.servings) as grams
      from public.cooks c
      join public.recipes rc on rc.id = c.recipe_id
      join public.recipe_ingredients ri on ri.recipe_id = c.recipe_id
      where c.meal_plan_id = p_plan_id and c.household_id = v_household
      group by ri.food_id
    )
    select n.food_id, n.grams as need, f.name, f.store_section,
           coalesce(sc.grams,
             (select sum(coalesce(g.need_grams, g.grams)) from public.grocery_list g
               where g.meal_plan_id = p_plan_id and g.food_id = n.food_id
                 and g.source in ('plan', 'plan_extra') and g.household_id = v_household), 0) as covered,
           coalesce(sc.pantry_credit, 0) as taken,
           coalesce((select sum(g.grams) from public.grocery_list g
                      where g.meal_plan_id = p_plan_id and g.food_id = n.food_id and g.purchased
                        and g.source in ('plan', 'plan_extra') and g.household_id = v_household), 0) as bought,
           coalesce((select pi.grams from public.pantry_items pi
                      where pi.household_id = v_household and pi.food_id = n.food_id), 0) as pantry
    from need n
    join public.foods f on f.id = n.food_id and f.household_id = v_household
    left join public.shopping_cover sc on sc.meal_plan_id = p_plan_id and sc.food_id = n.food_id
    order by coalesce(array_position(
               array['Produce', 'Meat & seafood', 'Dairy & eggs', 'Bakery & tortillas', 'Frozen',
                     'Canned & dry goods', 'Pantry', 'Drinks', 'Snacks', 'Other'], f.store_section), 10),
             f.name
  loop
    v_cover := r.covered;
    v_extra := v_cover > 0;
    v_credit := least(greatest(r.pantry - r.taken - r.bought, 0), greatest(r.need - v_cover, 0));
    v_short := r.need - v_cover - v_credit;

    if v_short > 0.5 then
      select * into m from public.shopping_measure(r.food_id, v_short);
      insert into public.grocery_list (item_name, quantity_needed, purchased, food_id, meal_plan_id, source,
                                       grams, need_grams, store_section, household_id,
                                       measure_kind, measure_label, measure_count)
      values (r.name, case when v_extra then '+' else '' end || m.summary, false,
              r.food_id, p_plan_id, case when v_extra then 'plan_extra' else 'plan' end,
              m.grams, v_short, r.store_section, v_household, m.kind, m.label, m.count);
      added := added + 1;
      v_cover := v_cover + v_short;
    end if;

    insert into public.shopping_cover (meal_plan_id, food_id, household_id, grams, pantry_credit)
    values (p_plan_id, r.food_id, v_household, v_cover + v_credit, r.taken + v_credit)
    on conflict (meal_plan_id, food_id) do update
      set grams = excluded.grams, pantry_credit = excluded.pantry_credit
      where public.shopping_cover.grams < excluded.grams;
  end loop;
  return added;
end $$;

revoke all on function public.sync_shopping_list(bigint) from public, anon;
grant execute on function public.sync_shopping_list(bigint) to authenticated;
