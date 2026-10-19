-- Calorie Manager: Plan grid editing (ticket #40)
-- Portions are private per Member (007, 032) and a Meal Time is visible only to its sharers
-- (013), so a Member cannot place a Portion for someone else with a plain insert. These
-- functions are the one write rule for the shared Meal Plan: each runs as the owner, checks the
-- caller belongs to the Household that owns the Plan, and writes only inside it. A Portion may
-- only go to a Member who shares that Meal Time (meal_time_members). Nothing here reads the
-- Calorie Log's contents: it is only asked whether a Portion has been logged (so a logged
-- Portion cannot be moved or removed from under the log).
--
-- Cook servings made: a new Cook starts at its Recipe's servings and only ever grows, to cover
-- all its Portions (never shrinks, so Leftovers are not lost when a Portion is removed).
-- Editing an approved plan is allowed; it sets meal_plans.changed_since_approval, which the
-- Plan grid shows. Approving (status to approved) or going back to draft clears it. Ticket 45
-- (Approve) should also clear it when an already-approved plan is approved again.
--
-- Also: plan_meal_times() lists every Meal Time of the Household (the grid needs empty slots
-- to add to; plan_week only returns those with a Portion), and plan_week() is re-created to
-- add changed_since_approval to its plan object. Nothing else in it changes.
--
-- Run against a LOCAL stack only; the test is supabase/tests/plan_edit_test.sql.

alter table public.meal_plans
  add column changed_since_approval boolean not null default false;
comment on column public.meal_plans.changed_since_approval is
  'True when an approved plan has been edited since it was approved. Cleared when the status changes.';

create or replace function private.meal_plans_clear_changed()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.changed_since_approval := false;
  end if;
  return new;
end $$;
create trigger meal_plans_clear_changed
before update of status on public.meal_plans
for each row execute function private.meal_plans_clear_changed();

-- 1. Reads ----------------------------------------------------------------------
-- plan_week(), as in 038 plus changed_since_approval on the plan object.
create or replace function public.plan_week(p_week_start date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_plan_id bigint;
  v_plan jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to see the plan' using errcode = '28000';
  end if;
  if p_week_start is null or extract(dow from p_week_start) <> 0 then
    raise exception 'A week starts on a Sunday' using errcode = '22023';
  end if;

  select mp.id,
         jsonb_build_object('id', mp.id, 'status', mp.status, 'week_start', mp.week_start,
                            'changed_since_approval', mp.changed_since_approval)
    into v_plan_id, v_plan
    from public.meal_plans mp
   where mp.week_start = p_week_start
     and mp.household_id in (select private.my_household_ids());

  return jsonb_build_object(
    'plan', v_plan,
    'cooks', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id,
               'recipe_id', c.recipe_id,
               'recipe_name', r.name,
               'cook_date', c.cook_date,
               'servings_made', c.servings_made,
               'kcal_per_serving', rt.kcal_per_serving
             ) order by c.cook_date, c.id)
        from public.cooks c
        join public.recipes r on r.id = c.recipe_id
        left join public.recipe_totals rt on rt.recipe_id = c.recipe_id
       where c.meal_plan_id = v_plan_id
    ), '[]'::jsonb),
    'portions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'cook_id', p.cook_id,
               'member_id', p.member_id,
               'meal_time_id', p.meal_time_id,
               'eat_date', p.eat_date,
               'servings', p.servings
             ) order by p.eat_date, p.id)
        from public.portions p
        join public.cooks c on c.id = p.cook_id
       where c.meal_plan_id = v_plan_id
    ), '[]'::jsonb),
    'meal_times', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', mt.id,
               'name', mt.name,
               'time_of_day', mt.time_of_day,
               'kind', mt.kind,
               'weekdays', mt.weekdays,
               'member_ids', (select coalesce(jsonb_agg(mtm.member_id order by mtm.member_id), '[]'::jsonb)
                                from public.meal_time_members mtm
                               where mtm.meal_time_id = mt.id)
             ) order by mt.time_of_day, mt.id)
        from public.meal_times mt
       where mt.id in (
         select p.meal_time_id
           from public.portions p
           join public.cooks c on c.id = p.cook_id
          where c.meal_plan_id = v_plan_id
       )
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id,
               'display_name', m.display_name,
               'role', m.role,
               'band_low', case when ms.calorie_target is null then null
                                else round(ms.calorie_target * ms.band_low_pct / 100.0) end,
               'band_high', case when ms.calorie_target is null then null
                                 else round(ms.calorie_target * ms.band_high_pct / 100.0) end
             ) order by m.created_at, m.id)
        from public.members m
        left join public.member_settings ms on ms.member_id = m.id
       where m.household_id in (select private.my_household_ids())
    ), '[]'::jsonb)
  );
end $$;
revoke all on function public.plan_week(date) from public, anon;
grant execute on function public.plan_week(date) to authenticated;

create or replace function public.plan_meal_times()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to see the plan' using errcode = '28000';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', mt.id,
             'name', mt.name,
             'time_of_day', mt.time_of_day,
             'kind', mt.kind,
             'weekdays', mt.weekdays,
             'member_ids', (select coalesce(jsonb_agg(mtm.member_id order by mtm.member_id), '[]'::jsonb)
                              from public.meal_time_members mtm
                             where mtm.meal_time_id = mt.id)
           ) order by mt.time_of_day, mt.id)
      from public.meal_times mt
     where mt.member_id in (
       select m.id from public.members m where m.household_id in (select private.my_household_ids())
     )
  ), '[]'::jsonb);
end $$;
revoke all on function public.plan_meal_times() from public, anon;
grant execute on function public.plan_meal_times() to authenticated;

-- 2. Writes ---------------------------------------------------------------------
-- Marks an approved plan as edited. Called by every write below.
create or replace function private.plan_touch(p_plan_id bigint)
returns void
language sql security definer set search_path = ''
as $$
  update public.meal_plans set changed_since_approval = true
   where id = p_plan_id and status = 'approved';
$$;
revoke all on function private.plan_touch(bigint) from public, anon;

-- Raises unless the caller is in the Household of the Cook; returns the Cook's plan id.
create or replace function private.plan_cook_guard(p_cook_id bigint)
returns bigint
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_plan bigint;
begin
  if auth.uid() is null then
    raise exception 'Sign in to change the plan' using errcode = '28000';
  end if;
  select c.meal_plan_id into v_plan
    from public.cooks c
   where c.id = p_cook_id and c.household_id in (select private.my_household_ids());
  if v_plan is null then
    raise exception 'Cook not found' using errcode = '42501';
  end if;
  return v_plan;
end $$;
revoke all on function private.plan_cook_guard(bigint) from public, anon;

-- Adds a Cook of a Recipe on a day, making the week's draft plan first if there is none.
create or replace function public.plan_add_cook(p_week_start date, p_recipe_id bigint, p_cook_date date)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_household bigint;
  v_plan bigint;
  v_servings numeric;
  v_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Sign in to change the plan' using errcode = '28000';
  end if;
  if p_week_start is null or extract(dow from p_week_start) <> 0 then
    raise exception 'A week starts on a Sunday' using errcode = '22023';
  end if;
  if p_cook_date is null or p_cook_date < p_week_start or p_cook_date > p_week_start + 6 then
    raise exception 'The cook day must be inside the week' using errcode = '22023';
  end if;
  select r.household_id, r.servings into v_household, v_servings
    from public.recipes r
   where r.id = p_recipe_id and r.household_id in (select private.my_household_ids());
  if v_household is null then
    raise exception 'Recipe not found' using errcode = '42501';
  end if;

  select mp.id into v_plan from public.meal_plans mp
   where mp.household_id = v_household and mp.week_start = p_week_start;
  if v_plan is null then
    insert into public.meal_plans (household_id, week_start) values (v_household, p_week_start)
      returning id into v_plan;
  end if;

  insert into public.cooks (meal_plan_id, household_id, recipe_id, cook_date, servings_made)
    values (v_plan, v_household, p_recipe_id, p_cook_date, greatest(v_servings, 0.25))
    returning id into v_id;
  perform private.plan_touch(v_plan);
  return v_id;
end $$;
revoke all on function public.plan_add_cook(date, bigint, date) from public, anon;
grant execute on function public.plan_add_cook(date, bigint, date) to authenticated;

-- Deletes a Cook; its Portions go with it (on delete cascade). Refused when one is logged.
create or replace function public.plan_delete_cook(p_cook_id bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_plan bigint := private.plan_cook_guard(p_cook_id);
begin
  if exists (
    select 1 from public.calorie_log cl
      join public.portions p on p.id = cl.portion_id
     where p.cook_id = p_cook_id
  ) then
    raise exception 'A Portion of this Cook is already logged' using errcode = '22023';
  end if;
  delete from public.cooks where id = p_cook_id;
  perform private.plan_touch(v_plan);
end $$;
revoke all on function public.plan_delete_cook(bigint) from public, anon;
grant execute on function public.plan_delete_cook(bigint) to authenticated;

-- Grows a Cook's servings made so it covers all its Portions. Never shrinks it.
create or replace function private.plan_grow_cook(p_cook_id bigint)
returns void
language sql security definer set search_path = ''
as $$
  update public.cooks c
     set servings_made = s.total
    from (select coalesce(sum(p.servings), 0) as total from public.portions p where p.cook_id = p_cook_id) s
   where c.id = p_cook_id and c.servings_made < s.total;
$$;
revoke all on function private.plan_grow_cook(bigint) from public, anon;

-- Puts (or resizes) one Member's Portion of a Cook at a Meal Time on a day. The Member must share
-- the Meal Time and be in the Cook's Household; the day must be inside the Cook's week.
create or replace function public.plan_set_portion(
  p_cook_id bigint, p_member_id bigint, p_meal_time_id bigint, p_eat_date date, p_servings numeric
) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_plan bigint := private.plan_cook_guard(p_cook_id);
  v_week date;
  v_id bigint;
begin
  if p_servings is null or p_servings <= 0 then
    raise exception 'A Portion needs servings above zero' using errcode = '22023';
  end if;
  select mp.week_start into v_week from public.meal_plans mp where mp.id = v_plan;
  if p_eat_date is null or p_eat_date < v_week or p_eat_date > v_week + 6 then
    raise exception 'The day must be inside the week' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.meal_time_members mtm
      join public.members m on m.id = mtm.member_id
     where mtm.meal_time_id = p_meal_time_id and mtm.member_id = p_member_id
       and m.household_id in (select private.my_household_ids())
  ) then
    raise exception 'That Member does not share this Meal Time' using errcode = '42501';
  end if;

  insert into public.portions (cook_id, member_id, meal_time_id, eat_date, servings)
    values (p_cook_id, p_member_id, p_meal_time_id, p_eat_date, p_servings)
    on conflict (member_id, meal_time_id, eat_date) do update
      set servings = excluded.servings
      where public.portions.cook_id = excluded.cook_id
    returning id into v_id;
  if v_id is null then
    raise exception 'That Member already has a Portion there' using errcode = '23505';
  end if;
  perform private.plan_grow_cook(p_cook_id);
  perform private.plan_touch(v_plan);
  return v_id;
end $$;
revoke all on function public.plan_set_portion(bigint, bigint, bigint, date, numeric) from public, anon;
grant execute on function public.plan_set_portion(bigint, bigint, bigint, date, numeric) to authenticated;

-- Moves a Portion to another Meal Time and/or day (same Member, same Cook). Refused when logged.
create or replace function public.plan_move_portion(p_portion_id bigint, p_meal_time_id bigint, p_eat_date date)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_cook bigint;
  v_member bigint;
  v_plan bigint;
  v_week date;
begin
  select p.cook_id, p.member_id into v_cook, v_member from public.portions p where p.id = p_portion_id;
  if v_cook is null then
    raise exception 'Portion not found' using errcode = '42501';
  end if;
  v_plan := private.plan_cook_guard(v_cook);
  if exists (select 1 from public.calorie_log cl where cl.portion_id = p_portion_id) then
    raise exception 'This Portion is already logged' using errcode = '22023';
  end if;
  select mp.week_start into v_week from public.meal_plans mp where mp.id = v_plan;
  if p_eat_date is null or p_eat_date < v_week or p_eat_date > v_week + 6 then
    raise exception 'The day must be inside the week' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.meal_time_members mtm
     where mtm.meal_time_id = p_meal_time_id and mtm.member_id = v_member
  ) then
    raise exception 'That Member does not share this Meal Time' using errcode = '42501';
  end if;
  update public.portions set meal_time_id = p_meal_time_id, eat_date = p_eat_date
   where id = p_portion_id;
  perform private.plan_touch(v_plan);
end $$;
revoke all on function public.plan_move_portion(bigint, bigint, date) from public, anon;
grant execute on function public.plan_move_portion(bigint, bigint, date) to authenticated;

-- Removes a Portion. Refused when logged. The Cook keeps its servings made (they become Leftovers).
create or replace function public.plan_remove_portion(p_portion_id bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_cook bigint;
  v_plan bigint;
begin
  select p.cook_id into v_cook from public.portions p where p.id = p_portion_id;
  if v_cook is null then
    raise exception 'Portion not found' using errcode = '42501';
  end if;
  v_plan := private.plan_cook_guard(v_cook);
  if exists (select 1 from public.calorie_log cl where cl.portion_id = p_portion_id) then
    raise exception 'This Portion is already logged' using errcode = '22023';
  end if;
  delete from public.portions where id = p_portion_id;
  perform private.plan_touch(v_plan);
end $$;
revoke all on function public.plan_remove_portion(bigint) from public, anon;
grant execute on function public.plan_remove_portion(bigint) to authenticated;
