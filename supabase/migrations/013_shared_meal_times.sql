-- Calorie Manager: shared Meal Times (ticket #22)
-- A Meal Time can be shared by several Members of one Household ("Family dinner 6:30").
-- The Meal Time itself (name, time, kind, weekdays) is shared. Each sharing Member keeps
-- their own calorie range in meal_time_members. meal_times.member_id is now the creator:
-- always a sharer, and only the creator can delete the Meal Time for everyone.
--
-- BACKFILL: each existing Meal Time gets one meal_time_members row for its Member, with
-- the Member's old calorie range copied across. Nothing else moves.
--
-- NOT ENFORCED IN THE DATABASE: that a sharer's row holds the number its Meal Time's kind
-- needs (Set needs set_calories; Planned and If room need a range). A kind change leaves
-- the other sharers' numbers as they were; the app shows a "needs calories" line for them.
--
-- Writes to the sharing list and to Meal Time fields go through save_meal_time(), one
-- transaction. Run against a LOCAL stack only; the tests are ticket #69.

-- 1. Each sharing Member's own calorie range
create table public.meal_time_members (
  meal_time_id bigint not null references public.meal_times(id) on delete cascade,
  member_id bigint not null references public.members(id) on delete cascade,
  cal_min integer,
  cal_max integer,
  set_calories integer,
  primary key (meal_time_id, member_id),
  check (cal_min is null or cal_max is null or cal_min <= cal_max)
);
create index meal_time_members_member_idx on public.meal_time_members (member_id);

-- 2. Backfill: every existing Meal Time keeps its Member's range
insert into public.meal_time_members (meal_time_id, member_id, cal_min, cal_max, set_calories)
  select id, member_id, cal_min, cal_max, set_calories from public.meal_times;

-- 3. The range now belongs to the sharing row (drops the checks that used these columns)
alter table public.meal_times
  drop column cal_min,
  drop column cal_max,
  drop column set_calories;

comment on column public.meal_times.member_id is 'The Member who created the Meal Time. Always a sharer.';

-- 4. Helper: the Meal Times the caller's Members share (SECURITY DEFINER, as in 005 and 007)
create or replace function private.my_meal_time_ids()
returns setof bigint
language sql stable security definer set search_path = ''
as $$
  select mtm.meal_time_id
  from public.meal_time_members mtm
  where mtm.member_id in (select private.my_member_ids());
$$;
revoke all on function private.my_meal_time_ids() from public, anon;
grant execute on function private.my_meal_time_ids() to authenticated;

-- 5. Row-level security
alter table public.meal_time_members enable row level security;

-- Direct writes go through save_meal_time() or the leave/delete policies below
revoke insert, update on public.meal_time_members from anon, authenticated;
revoke insert on public.meal_times from anon, authenticated;

drop policy meal_times_member_rows on public.meal_times;

create policy meal_times_shared_select on public.meal_times
  for select to authenticated
  using (id in (select private.my_meal_time_ids()));

create policy meal_times_shared_update on public.meal_times
  for update to authenticated
  using (id in (select private.my_meal_time_ids()))
  with check (id in (select private.my_meal_time_ids()));

create policy meal_times_creator_delete on public.meal_times
  for delete to authenticated
  using (member_id in (select private.my_member_ids()));

create policy meal_time_members_select on public.meal_time_members
  for select to authenticated
  using (meal_time_id in (select private.my_meal_time_ids()));

-- A sharer can stop sharing for their own Member, but never the creator (who deletes instead)
create policy meal_time_members_leave on public.meal_time_members
  for delete to authenticated
  using (
    member_id in (select private.my_member_ids())
    and not exists (
      select 1 from public.meal_times mt
      where mt.id = meal_time_members.meal_time_id
        and mt.member_id = meal_time_members.member_id
    )
  );

-- 6. Create or edit a Meal Time and its sharers in one transaction.
-- p_member_id is the Member whose grid is being edited; their range is p_cal_* and
-- p_set_calories. New sharers start with the same range. Sharers not in p_sharer_ids are
-- taken off, except the creator. The creator and p_member_id are always sharers.
-- Every sharer must be a Member of the same Household.
create or replace function public.save_meal_time(
  p_member_id bigint,
  p_meal_time_id bigint,
  p_name text,
  p_time_of_day time,
  p_kind text,
  p_weekdays smallint[],
  p_cal_min integer,
  p_cal_max integer,
  p_set_calories integer,
  p_sharer_ids bigint[]
)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_id bigint := p_meal_time_id;
  v_creator bigint;
  v_household bigint;
  v_sharers bigint[];
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

  -- New sharers start with the same range; existing sharers keep theirs
  insert into public.meal_time_members (meal_time_id, member_id, cal_min, cal_max, set_calories)
    select v_id, s, p_cal_min, p_cal_max, p_set_calories
    from unnest(v_sharers) as s
    on conflict (meal_time_id, member_id) do nothing;

  -- Removed sharers (the creator is always in v_sharers, so it stays)
  delete from public.meal_time_members
   where meal_time_id = v_id and member_id <> all(v_sharers);

  return v_id;
end $$;

revoke all on function public.save_meal_time(bigint, bigint, text, time, text, smallint[], integer, integer, integer, bigint[]) from public, anon;
grant execute on function public.save_meal_time(bigint, bigint, text, time, text, smallint[], integer, integer, integer, bigint[]) to authenticated;
