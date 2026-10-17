-- Calorie Manager: what other Members see (ticket #33)
-- By default another adult Member sees only an on track / over flag per day for you, not your
-- Calorie Log, Targets or weight. "Share everything" (members.share_everything) lets every adult
-- in your Household read your Calorie Log, Targets and weight. Dependents stay fully visible to
-- every adult (007, 030), whatever their flag says. Writes never widen: only the Member, and for
-- a Dependent the adults of its Household, can change a row (as before).
--
-- Who may read a Member's full data: private.member_data_readable_ids() (own Member and the
-- Household's Dependents, plus any Member in the Household who shares everything). The Calorie
-- Log, Targets and weight read policies use it. The weight read hook from 030 is widened here.
--
-- Shared Meal Plan: not in the database yet. When it lands, its read rule is its own policy.
-- Portions (per Member, 007) stay private to the Member and their adults until that ticket.
--
-- Meal Time sharing (013) is unchanged: a Meal Time shared with you exposes its sharers' calorie
-- ranges (meal_time_members_select). That is a deliberate design of 013, not changed here.
--
-- Run against a LOCAL stack only; the tests are ticket #69.

-- 1. The switch ------------------------------------------------------------------
alter table public.members add column share_everything boolean not null default false;
comment on column public.members.share_everything is 'When true, every adult in the Household reads this Member''s Calorie Log, Targets and weight. Set only by set_share_everything().';

-- Turns the caller's own switch on or off (their own Member only; the Owner cannot change another Member's)
create or replace function public.set_share_everything(p_share boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in before changing sharing' using errcode = '28000';
  end if;
  update public.members
     set share_everything = coalesce(p_share, false)
   where user_id = auth.uid();
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'No Member for this login' using errcode = '42501';
  end if;
end $$;
revoke all on function public.set_share_everything(boolean) from public, anon;
grant execute on function public.set_share_everything(boolean) to authenticated;

-- 2. Who the caller may read in full ---------------------------------------------
-- The caller's own Member and the Household's Dependents (private.my_member_ids, 007), plus every
-- Member of the caller's Household who shares everything. SECURITY DEFINER, empty search_path.
create or replace function private.member_data_readable_ids()
returns setof bigint
language sql stable security definer set search_path = ''
as $$
  select m.id from public.members m
  where m.id in (select private.my_member_ids())
  union
  select m.id from public.members m
  where m.share_everything
    and m.household_id in (select private.my_household_ids());
$$;
revoke all on function private.member_data_readable_ids() from public, anon;
grant execute on function private.member_data_readable_ids() to authenticated;

-- 3. Weight: widen the 030 hook --------------------------------------------------
create or replace function private.weight_readable_by_caller(p_member_id bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_member_id in (select private.member_data_readable_ids());
$$;

-- 4. Calorie Log and Targets: reads widen, writes do not -------------------------
drop policy calorie_log_member_rows on public.calorie_log;

create policy calorie_log_read on public.calorie_log
  for select to authenticated
  using (member_id in (select private.member_data_readable_ids()));

create policy calorie_log_insert on public.calorie_log
  for insert to authenticated
  with check (member_id in (select private.my_member_ids()));

create policy calorie_log_update on public.calorie_log
  for update to authenticated
  using (member_id in (select private.my_member_ids()))
  with check (member_id in (select private.my_member_ids()));

create policy calorie_log_delete on public.calorie_log
  for delete to authenticated
  using (member_id in (select private.my_member_ids()));

drop policy member_settings_member_rows on public.member_settings;

create policy member_settings_read on public.member_settings
  for select to authenticated
  using (member_id in (select private.member_data_readable_ids()));

create policy member_settings_insert on public.member_settings
  for insert to authenticated
  with check (member_id in (select private.my_member_ids()));

create policy member_settings_update on public.member_settings
  for update to authenticated
  using (member_id in (select private.my_member_ids()))
  with check (member_id in (select private.my_member_ids()));

create policy member_settings_delete on public.member_settings
  for delete to authenticated
  using (member_id in (select private.my_member_ids()));

-- 5. Day flags for Members who do not share --------------------------------------
-- One row per logged day in the range: the day key and whether its calories are over the
-- Calorie Target (kcal above the Target). is_over is NULL when the Member has no Calorie Target.
-- No calories, macros or Targets are returned. Any adult in the same Household may ask, for any
-- Member of it; anyone else gets no rows. SECURITY DEFINER, so the flags do not depend on the
-- caller's row-level security.
create or replace function public.member_day_flags(p_member_id bigint, p_start date, p_end date)
returns table (day_key date, is_over boolean)
language sql stable security definer set search_path = ''
as $$
  select c.log_date as day_key,
         case when s.calorie_target is null then null
              else sum(c.kcal) > s.calorie_target
         end as is_over
  from public.calorie_log c
  join public.member_settings s on s.member_id = c.member_id
  where c.member_id = p_member_id
    and c.log_date between p_start and p_end
    and p_member_id in (
      select m.id from public.members m
      where m.household_id in (select private.my_household_ids())
    )
  group by c.log_date, s.calorie_target
  order by c.log_date;
$$;
revoke all on function public.member_day_flags(bigint, date, date) from public, anon;
grant execute on function public.member_day_flags(bigint, date, date) to authenticated;
