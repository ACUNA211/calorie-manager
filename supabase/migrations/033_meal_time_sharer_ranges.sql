-- Calorie Manager: a new sharer sets their own calorie range (ticket #22, decided in #72)
-- Replaces save_meal_time() from 013. Before, every new sharer copied the editor's range.
-- Now each new sharer's range comes from p_sharer_ranges, one entry per new sharer:
--   [{"member_id": 9, "cal_min": 500, "cal_max": 700, "set_calories": null}, ...]
-- A new sharer with no entry is refused (22023), never given someone else's range.
-- Existing sharers keep their own rows (on conflict do nothing). The editing Member's own
-- range still comes from p_cal_min, p_cal_max and p_set_calories.
-- Everything else is as in 013. Run against a LOCAL stack only; the tests are in
-- supabase/tests/meal_time_sharer_ranges_test.sql.

drop function public.save_meal_time(bigint, bigint, text, time, text, smallint[], integer, integer, integer, bigint[]);

create function public.save_meal_time(
  p_member_id bigint,
  p_meal_time_id bigint,
  p_name text,
  p_time_of_day time,
  p_kind text,
  p_weekdays smallint[],
  p_cal_min integer,
  p_cal_max integer,
  p_set_calories integer,
  p_sharer_ids bigint[],
  p_sharer_ranges jsonb
)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_id bigint := p_meal_time_id;
  v_creator bigint;
  v_household bigint;
  v_sharers bigint[];
  v_new_sharers bigint[];
begin
  if p_member_id is null or not (p_member_id in (select private.my_member_ids())) then
    raise exception 'Not your Member' using errcode = '42501';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'A Meal Time needs a name' using errcode = '22023';
  end if;
  if p_kind not in ('set', 'planned', 'if_room') then
    raise exception 'Unknown kind %', p_kind using errcode = '22023';
  end if;
  if p_weekdays is null or exists (select 1 from unnest(p_weekdays) d where d < 0 or d > 6) then
    raise exception 'Weekdays must be 0 (Sunday) to 6 (Saturday)' using errcode = '22023';
  end if;

  select m.household_id into v_household from public.members m where m.id = p_member_id;

  if v_id is null then
    insert into public.meal_times (member_id, name, time_of_day, kind, weekdays)
      values (p_member_id, trim(p_name), p_time_of_day, p_kind, p_weekdays)
      returning id into v_id;
    v_creator := p_member_id;
  else
    select mt.member_id into v_creator from public.meal_times mt where mt.id = v_id;
    if v_creator is null
       or not exists (
         select 1 from public.meal_time_members mtm
         where mtm.meal_time_id = v_id and mtm.member_id = p_member_id
       ) then
      raise exception 'Meal Time not found' using errcode = '42501';
    end if;
    update public.meal_times
       set name = trim(p_name), time_of_day = p_time_of_day, kind = p_kind, weekdays = p_weekdays
     where id = v_id;
  end if;

  v_sharers := array(
    select distinct s
    from unnest(coalesce(p_sharer_ids, '{}'::bigint[]) || array[v_creator, p_member_id]) as s
    where s is not null
  );
  if exists (
    select 1 from unnest(v_sharers) s
    where s not in (select m.id from public.members m where m.household_id = v_household)
  ) then
    raise exception 'Every sharer must be a Member of the same Household' using errcode = '42501';
  end if;

  -- The editing Member's own range
  insert into public.meal_time_members (meal_time_id, member_id, cal_min, cal_max, set_calories)
    values (v_id, p_member_id, p_cal_min, p_cal_max, p_set_calories)
    on conflict (meal_time_id, member_id) do update
      set cal_min = excluded.cal_min,
          cal_max = excluded.cal_max,
          set_calories = excluded.set_calories;

  -- New sharers: those not yet sharing this Meal Time, other than the editing Member
  v_new_sharers := array(
    select s from unnest(v_sharers) as s
    where s <> p_member_id
      and not exists (
        select 1 from public.meal_time_members mtm
        where mtm.meal_time_id = v_id and mtm.member_id = s
      )
  );

  -- Each new sharer needs an entry of their own in p_sharer_ranges
  if exists (
    select 1 from unnest(v_new_sharers) n
    where not exists (
      select 1
      from jsonb_to_recordset(coalesce(p_sharer_ranges, '[]'::jsonb))
        as r(member_id bigint, cal_min integer, cal_max integer, set_calories integer)
      where r.member_id = n
    )
  ) then
    raise exception 'Every new sharer needs their own calorie range' using errcode = '22023';
  end if;

  -- New sharers get their own range; existing sharers keep theirs
  insert into public.meal_time_members (meal_time_id, member_id, cal_min, cal_max, set_calories)
    select v_id, r.member_id, r.cal_min, r.cal_max, r.set_calories
    from jsonb_to_recordset(coalesce(p_sharer_ranges, '[]'::jsonb))
      as r(member_id bigint, cal_min integer, cal_max integer, set_calories integer)
    where r.member_id = any(v_new_sharers)
    on conflict (meal_time_id, member_id) do nothing;

  -- Removed sharers (the creator is always in v_sharers, so it stays)
  delete from public.meal_time_members
   where meal_time_id = v_id and member_id <> all(v_sharers);

  return v_id;
end $$;

revoke all on function public.save_meal_time(bigint, bigint, text, time, text, smallint[], integer, integer, integer, bigint[], jsonb) from public, anon;
grant execute on function public.save_meal_time(bigint, bigint, text, time, text, smallint[], integer, integer, integer, bigint[], jsonb) to authenticated;
