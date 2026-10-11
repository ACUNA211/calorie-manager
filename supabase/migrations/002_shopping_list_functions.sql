-- Shopping list from an approved Meal Plan (#20) and extra lines when a Cook grows (#21).
-- One rule covers both: for each food, what the approved plan needs minus what the
-- plan already put on the list. A shortfall becomes a new unticked line; nothing is
-- ever unticked, reduced or removed.

create or replace function public.shopping_measure(p_food_id bigint, p_grams numeric)
returns table (label text, grams numeric)
language plpgsql stable set search_path = public as $$
declare
  s jsonb;
  n integer;
begin
  -- the food's largest serving size is its shopping measure (a can, a bag, a pack)
  select x into s
  from public.foods f, jsonb_array_elements(f.servings) x
  where f.id = p_food_id and (x->>'grams')::numeric > 0
  order by (x->>'grams')::numeric desc limit 1;
  if s is not null then
    n := ceil(p_grams / (s->>'grams')::numeric);
    label := n || ' × ' || (s->>'label') || ' (' || round((s->>'grams')::numeric) || ' g)';
    grams := n * (s->>'grams')::numeric;
  else
    grams := ceil(p_grams / 50) * 50;
    label := grams || ' g (' || round(grams / 453.6, 1) || ' lb)';
  end if;
  return next;
end $$;

create or replace function public.sync_shopping_list(p_plan_id bigint)
returns integer
language plpgsql set search_path = public as $$
declare
  r record;
  m record;
  added integer := 0;
begin
  if (select status from public.meal_plans where id = p_plan_id) is distinct from 'approved' then
    return 0;
  end if;
  for r in
    with need as (
      select ri.food_id, sum(ri.grams * c.servings_made / rc.servings) as grams
      from public.cooks c
      join public.recipes rc on rc.id = c.recipe_id
      join public.recipe_ingredients ri on ri.recipe_id = c.recipe_id
      where c.meal_plan_id = p_plan_id
      group by ri.food_id
    ), covered as (
      select food_id, sum(grams) as grams
      from public.grocery_list
      where meal_plan_id = p_plan_id and source in ('plan','plan_extra')
      group by food_id
    )
    select n.food_id, n.grams - coalesce(cv.grams, 0) as short, cv.food_id is not null as had_line,
           f.name, f.store_section
    from need n
    join public.foods f on f.id = n.food_id
    left join covered cv on cv.food_id = n.food_id
    where n.grams - coalesce(cv.grams, 0) > 0.5
  loop
    select * into m from public.shopping_measure(r.food_id, r.short);
    insert into public.grocery_list (item_name, quantity_needed, purchased, food_id, meal_plan_id, source, grams, store_section)
    values (r.name, case when r.had_line then '+' else '' end || m.label, false,
            r.food_id, p_plan_id, case when r.had_line then 'plan_extra' else 'plan' end, m.grams, r.store_section);
    added := added + 1;
  end loop;
  return added;
end $$;

create or replace function public.approve_meal_plan(p_plan_id bigint)
returns integer
language plpgsql set search_path = public as $$
begin
  update public.meal_plans set status = 'approved', approved_at = coalesce(approved_at, now())
  where id = p_plan_id;
  return public.sync_shopping_list(p_plan_id);
end $$;

create or replace function public.cooks_sync_trigger()
returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op in ('INSERT','UPDATE') then
    perform public.sync_shopping_list(new.meal_plan_id);
  end if;
  return null;
end $$;

create trigger cooks_sync_shopping
after insert or update of servings_made, recipe_id on public.cooks
for each row execute function public.cooks_sync_trigger();
