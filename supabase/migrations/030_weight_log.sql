-- Calorie Manager: weight log (ticket #32)
-- One weight per Member per day, in kilograms to one decimal. Everything is stored in
-- metric (ground rules); display units come with ticket #11.
--
-- Weight is private (CONTEXT.md, Calorie Log): the Member reads and writes their own
-- weight, and every adult reads and writes a Dependent's weight. That is the same rule
-- as the Calorie Log (007), through private.my_member_ids(). Other adult Members see
-- nothing here.
--
-- HOOK for ticket #33 ("share everything"): read access goes only through
-- private.weight_readable_by_caller(). Ticket 33 widens that function (for example, to
-- allow Members who turned on "share everything") and the read policy needs no change.
-- Writes never widen: only the Member and, for a Dependent, the adults of its Household
-- can write.
--
-- Run against a LOCAL stack only; the tests are ticket #69.

-- 1. The table -------------------------------------------------------------------
create table public.weight_log (
  id bigint generated always as identity primary key,
  member_id bigint not null references public.members(id) on delete cascade,
  log_date date not null,
  kg numeric(4,1) not null check (kg >= 20 and kg <= 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weight_log_member_day_key unique (member_id, log_date)
);

-- 2. The read hook (ticket #33 widens this) --------------------------------------
-- True when the caller may read this Member's weight. Today: the caller's own Member,
-- or a Dependent of the caller's Household (private.my_member_ids, from 007).
create or replace function private.weight_readable_by_caller(p_member_id bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  -- TICKET #33 HOOK: also allow other adults here when the Member shares everything.
  select p_member_id in (select private.my_member_ids());
$$;
revoke all on function private.weight_readable_by_caller(bigint) from public, anon;
grant execute on function private.weight_readable_by_caller(bigint) to authenticated;

-- 3. Row-level security and grants -----------------------------------------------
alter table public.weight_log enable row level security;
revoke all on public.weight_log from anon;
grant select, insert, update, delete on public.weight_log to authenticated;

create policy weight_log_read on public.weight_log
  for select to authenticated
  using (private.weight_readable_by_caller(member_id));

create policy weight_log_insert on public.weight_log
  for insert to authenticated
  with check (member_id in (select private.my_member_ids()));

create policy weight_log_update on public.weight_log
  for update to authenticated
  using (member_id in (select private.my_member_ids()))
  with check (member_id in (select private.my_member_ids()));

create policy weight_log_delete on public.weight_log
  for delete to authenticated
  using (member_id in (select private.my_member_ids()));
