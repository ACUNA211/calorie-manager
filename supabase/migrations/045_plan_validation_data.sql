-- Calorie Manager: data for the plan validator (ticket #41)
-- The validator (web/src/lib/planValidator.js) is pure JavaScript. plan_week() and
-- plan_meal_times() give it the grid, but three things it checks are not in them:
--   ranges     each sharing Member's own calorie range at each Meal Time (meal_time_members is
--              visible only to the sharer, 013, so a plain select cannot read the others)
--   breaks     the Hard-rule breaks (040) for the Recipes of this plan and the Members who eat them
--   recipe_ids which of the plan's Recipes still exist
-- One security-definer read of the caller's own Household. Nothing is written.
--   { ranges:  [{ meal_time_id, member_id, cal_min, cal_max, set_calories }],
--     breaks:  [{ recipe_id, member_id, rule_kind, rule, food_id, food_name }],
--     recipe_ids: [bigint] }
-- Run against a LOCAL stack only; the test is supabase/tests/plan_validation_data_test.sql
-- (written, not run when made).

create or replace function public.plan_validation_data(p_week_start date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_household bigint;
  v_plan_id bigint;
  v_members bigint[];
begin
  if auth.uid() is null then
    raise exception 'Sign in to see the plan' using errcode = '28000';
  end if;
  if p_week_start is null or extract(dow from p_week_start) <> 0 then
    raise exception 'A week starts on a Sunday' using errcode = '22023';
  end if;

  select mp.id, mp.household_id into v_plan_id, v_household
    from public.meal_plans mp
   where mp.week_start = p_week_start
     and mp.household_id in (select private.my_household_ids());
  if v_plan_id is null then
    return jsonb_build_object('ranges', '[]'::jsonb, 'breaks', '[]'::jsonb, 'recipe_ids', '[]'::jsonb);
  end if;

  select coalesce(array_agg(m.id), '{}') into v_members
    from public.members m where m.household_id = v_household;

  return jsonb_build_object(
    'ranges', coalesce((
      select jsonb_agg(jsonb_build_object(
               'meal_time_id', mtm.meal_time_id, 'member_id', mtm.member_id,
               'cal_min', mtm.cal_min, 'cal_max', mtm.cal_max, 'set_calories', mtm.set_calories
             ) order by mtm.meal_time_id, mtm.member_id)
        from public.meal_time_members mtm
        join public.meal_times mt on mt.id = mtm.meal_time_id
       where mtm.member_id = any (v_members)
    ), '[]'::jsonb),
    'breaks', coalesce((
      select jsonb_agg(jsonb_build_object(
               'recipe_id', b.recipe_id, 'member_id', b.member_id, 'rule_kind', b.rule_kind,
               'rule', b.rule, 'food_id', b.food_id, 'food_name', b.food_name
             ) order by b.recipe_id, b.member_id, b.rule)
        from private.hard_rule_breaks_core(v_members, v_household) b
       where b.recipe_id in (select c.recipe_id from public.cooks c where c.meal_plan_id = v_plan_id)
         and b.member_id in (
           select p.member_id from public.portions p
             join public.cooks c on c.id = p.cook_id
            where c.meal_plan_id = v_plan_id)
    ), '[]'::jsonb),
    'recipe_ids', coalesce((
      select jsonb_agg(r.id order by r.id)
        from public.recipes r
       where r.household_id = v_household
         and r.id in (select c.recipe_id from public.cooks c where c.meal_plan_id = v_plan_id)
    ), '[]'::jsonb)
  );
end $$;
revoke all on function public.plan_validation_data(date) from public, anon;
grant execute on function public.plan_validation_data(date) to authenticated;
