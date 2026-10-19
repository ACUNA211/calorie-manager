-- Calorie Manager: Plan grid, read side (ticket #39)
-- The Meal Plan, Cooks and Portions tables already exist (001; Household scope 006; Portions
-- per Member 007). Nothing new is stored here. What is missing is a way to READ the whole
-- Household's plan: Portions stay private to their Member (007, 032), and a Meal Time is
-- visible only to its sharers (013), so a plain select cannot build a grid of everyone.
--
-- plan_week(p_week_start) is the one read rule for the shared Meal Plan (032 left it to this
-- ticket). It runs as the owner but only ever returns rows of the caller's own Household,
-- and only what the grid shows: the Cooks (with the Recipe's name and calories per serving),
-- each Member's Portions, the Meal Times those Portions sit at, and each Member's Planning
-- band in calories. It does not return Calorie Logs, weight, protein or other Targets, and it
-- does not return the Calorie Target itself, only the band. Writes are unchanged (tickets
-- 40 and later).
--
-- Returns one jsonb object:
--   plan:       { id, status, week_start } or null when the week has no plan yet
--   cooks:      [{ id, recipe_id, recipe_name, cook_date, servings_made, kcal_per_serving }]
--   portions:   [{ id, cook_id, member_id, meal_time_id, eat_date, servings }]
--   meal_times: [{ id, name, time_of_day, kind, weekdays, member_ids }]  (sharers in member_ids)
--   members:    [{ id, display_name, role, band_low, band_high }]   (band null without a Target)
--
-- Run against a LOCAL stack only; the test is supabase/tests/plan_week_test.sql.

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
         jsonb_build_object('id', mp.id, 'status', mp.status, 'week_start', mp.week_start)
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
