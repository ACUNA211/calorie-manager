-- Calorie Manager: Households and Members (ticket #05)
-- A Household holds Members. A Member is a person with a login (user_id set) or a
-- Dependent (role 'dependent', no login, user_id null). A user belongs to at most one
-- Household. Row-level security lets a person read only their own Household. Writes
-- go through create_household(), which makes the caller its Owner in one transaction.

create schema if not exists private;

create table public.households (
  id bigint generated always as identity primary key,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.members (
  id bigint generated always as identity primary key,
  household_id bigint not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  role text not null check (role in ('owner','member','dependent')),
  created_at timestamptz not null default now(),
  check ((role = 'dependent') = (user_id is null))
);

-- A user is in at most one Household
create unique index members_user_id_key on public.members (user_id) where user_id is not null;
-- One Owner per Household
create unique index members_one_owner_key on public.members (household_id) where role = 'owner';
create index members_household_idx on public.members (household_id);

-- Caller's Household ids. SECURITY DEFINER so the policies can read members
-- without recursing into members' own RLS. Empty search_path: every name is qualified.
create or replace function private.my_household_ids()
returns setof bigint
language sql stable security definer set search_path = ''
as $$
  select m.household_id from public.members m where m.user_id = auth.uid();
$$;
revoke all on function private.my_household_ids() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.my_household_ids() to authenticated;

-- Creates a Household and its Owner (the caller) atomically
create or replace function public.create_household(p_name text, p_owner_name text)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_household bigint;
begin
  if v_uid is null then
    raise exception 'Sign in before creating a Household' using errcode = '28000';
  end if;
  if exists (select 1 from public.members m where m.user_id = v_uid) then
    raise exception 'You already belong to a Household' using errcode = 'P0001';
  end if;
  insert into public.households (name) values (trim(p_name)) returning id into v_household;
  insert into public.members (household_id, user_id, display_name, role)
    values (v_household, v_uid, trim(p_owner_name), 'owner');
  return v_household;
end $$;
revoke all on function public.create_household(text, text) from public, anon;
grant execute on function public.create_household(text, text) to authenticated;

-- No direct writes from the app: defence in depth on top of RLS
revoke insert, update, delete on public.households from anon, authenticated;
revoke insert, update, delete on public.members from anon, authenticated;

alter table public.households enable row level security;
alter table public.members enable row level security;

create policy households_select_own on public.households
  for select to authenticated
  using (id in (select private.my_household_ids()));

create policy members_select_own on public.members
  for select to authenticated
  using (household_id in (select private.my_household_ids()));
