-- Calorie Manager: personal tables move to Members (ticket #09)
-- Meal Times, Portions and the Calorie Log belong to a Member, not the Household.
-- The one-row member_settings becomes one settings row per Member.
--
-- BACKFILL RULE (existing rows go to the Owner's Member):
--   1. If no Household exists yet and exactly one auth user exists, that user becomes
--      the Owner of a new Household named 'Household' (display name from the email
--      prefix, else 'Owner'). With no auth user, no Household is created.
--   2. Existing Meal Times, Portions and Calorie Log rows get the Owner's Member.
--      If rows exist and there is not exactly one Owner, the migration raises an
--      error and rolls back: it never guesses whose data it is.
--   3. With no rows and no Owner, the backfill is a no-op and the migration still
--      succeeds.
--   4. The one settings row (calorie_target, band_low_pct, band_high_pct) is copied to
--      the Owner's settings row. Every other Member gets a default settings row. If
--      there is no Owner, the legacy row is kept as member_settings_legacy (not
--      dropped) so no Target is lost.
--
-- RLS: a person reads and writes rows of their own Member, and of the Dependents in
-- their Household. Other adult Members' rows stay private (ticket #33 decides that).
-- Functions from 001-004 do not read these tables, so none are replaced.

-- 1. The Owner's Household, if none exists yet (rule 1), and the rule 2 check
do $$
declare
  v_rows bigint;
  v_users bigint;
  v_households bigint;
  v_owners bigint;
  v_uid uuid;
  v_email text;
  v_household bigint;
begin
  select (select count(*) from public.meal_times)
       + (select count(*) from public.portions)
       + (select count(*) from public.calorie_log)
    into v_rows;

  select count(*) into v_households from public.households;
  if v_households = 0 then
    select count(*) into v_users from auth.users;
    if v_users = 1 then
      select u.id, u.email into v_uid, v_email from auth.users u;
      insert into public.households (name) values ('Household') returning id into v_household;
      insert into public.members (household_id, user_id, display_name, role)
      values (v_household, v_uid,
              coalesce(nullif(trim(split_part(coalesce(v_email, ''), '@', 1)), ''), 'Owner'),
              'owner');
    elsif v_rows > 0 then
      raise exception 'Personal rows exist, but % signed-in users and no Household: cannot choose an Owner. Create the Household first and re-run.', v_users;
    end if;
  end if;

  select count(*) into v_owners from public.members where role = 'owner';
  if v_owners <> 1 and v_rows > 0 then
    raise exception 'Personal rows exist, but % Owners were found: expected exactly one', v_owners;
  end if;
end $$;

-- 2. member_id on the personal tables (nullable until backfilled)
alter table public.meal_times add column member_id bigint references public.members(id) on delete cascade;
alter table public.portions add column member_id bigint references public.members(id) on delete cascade;
alter table public.calorie_log add column member_id bigint references public.members(id) on delete cascade;

-- 3. The new settings table, one row per Member
create table public.member_settings_v2 (
  id bigint generated always as identity primary key,
  member_id bigint not null unique references public.members(id) on delete cascade,
  calorie_target integer check (calorie_target > 0),
  band_low_pct integer not null default 90 check (band_low_pct between 50 and 100),
  band_high_pct integer not null default 100 check (band_high_pct between 50 and 100),
  updated_at timestamptz not null default now(),
  check (band_low_pct <= band_high_pct)
);

-- 4. Backfill to the Owner's Member and move the settings row (rules 2 to 4)
do $$
declare
  v_owner bigint;
  v_owners integer;
begin
  select count(*) into v_owners from public.members where role = 'owner';
  if v_owners = 1 then
    select id into v_owner from public.members where role = 'owner';
  end if;

  if v_owner is not null then
    update public.meal_times set member_id = v_owner where member_id is null;
    update public.portions set member_id = v_owner where member_id is null;
    update public.calorie_log set member_id = v_owner where member_id is null;
  end if;

  -- a default settings row for every Member (the Owner's gets the legacy values below)
  insert into public.member_settings_v2 (member_id)
    select id from public.members
    on conflict (member_id) do nothing;

  if v_owner is not null then
    update public.member_settings_v2 s
       set calorie_target = l.calorie_target,
           band_low_pct = l.band_low_pct,
           band_high_pct = l.band_high_pct,
           updated_at = l.updated_at
      from public.member_settings l
     where l.id = 1 and s.member_id = v_owner;
  end if;

  if v_owner is not null or not exists (select 1 from public.member_settings where id = 1) then
    drop table public.member_settings;
  else
    alter table public.member_settings rename to member_settings_legacy;
  end if;
end $$;

alter table public.member_settings_v2 rename to member_settings;

-- 5. Required from now on, and the Portion key is per Member
alter table public.meal_times alter column member_id set not null;
alter table public.portions alter column member_id set not null;
alter table public.calorie_log alter column member_id set not null;

alter table public.portions drop constraint if exists portions_meal_time_id_eat_date_key;
alter table public.portions add constraint portions_member_meal_time_date_key
  unique (member_id, meal_time_id, eat_date);

create index meal_times_member_idx on public.meal_times (member_id);
create index portions_member_idx on public.portions (member_id);
create index calorie_log_member_date_idx on public.calorie_log (member_id, log_date);

-- 6. Helper: the Members the caller may read and write. Own Member, plus the
-- Dependents of the caller's Households (a Dependent has no login, so the caller is an
-- adult). Same style as private.my_household_ids() in 005: SECURITY DEFINER,
-- empty search_path, every name qualified.
create or replace function private.my_member_ids()
returns setof bigint
language sql stable security definer set search_path = ''
as $$
  select m.id from public.members m where m.user_id = auth.uid()
  union
  select d.id from public.members d
  where d.role = 'dependent'
    and d.household_id in (select private.my_household_ids());
$$;
revoke all on function private.my_member_ids() from public, anon;
grant execute on function private.my_member_ids() to authenticated;

-- 7. A new Member gets a settings row (default Target and band)
create or replace function private.members_default_settings()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.member_settings (member_id) values (new.id)
  on conflict (member_id) do nothing;
  return new;
end $$;
revoke all on function private.members_default_settings() from public, anon, authenticated;

create trigger members_default_settings
after insert on public.members
for each row execute function private.members_default_settings();

-- 8. Row-level security (already enabled in 001 for these tables; enabled again for the new one)
alter table public.member_settings enable row level security;

create policy meal_times_member_rows on public.meal_times
  for all to authenticated
  using (member_id in (select private.my_member_ids()))
  with check (member_id in (select private.my_member_ids()));

create policy portions_member_rows on public.portions
  for all to authenticated
  using (member_id in (select private.my_member_ids()))
  with check (member_id in (select private.my_member_ids()));

create policy calorie_log_member_rows on public.calorie_log
  for all to authenticated
  using (member_id in (select private.my_member_ids()))
  with check (member_id in (select private.my_member_ids()));

create policy member_settings_member_rows on public.member_settings
  for all to authenticated
  using (member_id in (select private.my_member_ids()))
  with check (member_id in (select private.my_member_ids()));
