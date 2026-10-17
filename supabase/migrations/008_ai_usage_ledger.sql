-- Calorie Manager: AI usage ledger and monthly cap (ticket #12)
-- Every AI, Jev and translation call is recorded in ai_usage by an Edge Function, using
-- the service role. Writes from the app are blocked: the table has no insert, update or
-- delete grant for anon or authenticated, and no insert policy.
--
-- The monthly cap lives in household_settings, one row per Household, not as a column on
-- households. Reason: Household settings will grow (ticket #53 and later), and a separate
-- table keeps that out of the households row. A trigger creates the row for each new
-- Household, and this migration backfills the existing ones. The cap is USD per provider
-- per calendar month (UTC), default 5.00 (ADR 0002). Only the service role changes it for
-- now; an Owner-facing setter comes with a later ticket.
--
-- The spend view for the app is public.ai_spend_this_month(), which is SECURITY INVOKER and
-- restricted to the Owner (per ticket #12: the Owner sees spend in Settings).

-- 1. The usage ledger -------------------------------------------------------------
create table public.ai_usage (
  id bigint generated always as identity primary key,
  household_id bigint not null references public.households(id) on delete cascade,
  member_id bigint references public.members(id) on delete set null,
  provider text not null check (length(trim(provider)) > 0),
  model text not null check (length(trim(model)) > 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_usd numeric(12,6) not null default 0 check (cost_usd >= 0),
  created_at timestamptz not null default now()
);

create index ai_usage_household_provider_month_idx
  on public.ai_usage (household_id, provider, created_at);

-- 2. The cap setting, one row per Household ---------------------------------------
create table public.household_settings (
  household_id bigint primary key references public.households(id) on delete cascade,
  ai_monthly_cap_usd numeric(10,2) not null default 5.00 check (ai_monthly_cap_usd >= 0),
  updated_at timestamptz not null default now()
);

-- New Households get a settings row (default cap) in the same transaction
create or replace function private.households_default_settings()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.household_settings (household_id) values (new.id)
  on conflict (household_id) do nothing;
  return new;
end $$;
revoke all on function private.households_default_settings() from public, anon, authenticated;

create trigger households_default_settings
after insert on public.households
for each row execute function private.households_default_settings();

-- Backfill: every existing Household gets the default cap
insert into public.household_settings (household_id)
  select id from public.households
  on conflict (household_id) do nothing;

-- 3. Grants: the app reads, only the service role writes ----------------------------
-- Supabase's default privileges grant everything on new public tables, so revoke first.
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;

revoke all on public.household_settings from anon, authenticated;
grant select on public.household_settings to authenticated;

-- 4. Row-level security -------------------------------------------------------------
alter table public.ai_usage enable row level security;
alter table public.household_settings enable row level security;

-- Members of the Household can read its ledger and cap. No insert policy exists, so
-- only the service role (which bypasses RLS) can write ai_usage.
create policy ai_usage_select_household on public.ai_usage
  for select to authenticated
  using (household_id in (select private.my_household_ids()));

create policy household_settings_select_household on public.household_settings
  for select to authenticated
  using (household_id in (select private.my_household_ids()));

-- 5. This month's spend per provider for the caller's Household ---------------------
-- Owner only. Returns one row per provider with usage this month (UTC). The cap is read
-- from household_settings by the app. SECURITY INVOKER: the RLS policies above apply.
-- Output columns are named provider_name, spend_usd so they do not clash with ai_usage.
create or replace function public.ai_spend_this_month()
returns table (provider_name text, spend_usd numeric)
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_household bigint;
  v_month_start timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
begin
  select m.household_id into v_household
    from public.members m
   where m.user_id = auth.uid() and m.role = 'owner';
  if v_household is null then
    raise exception 'Only the Owner can see AI spend' using errcode = '42501';
  end if;

  return query
    select u.provider, coalesce(sum(u.cost_usd), 0)::numeric
      from public.ai_usage u
     where u.household_id = v_household
       and u.created_at >= v_month_start
     group by u.provider
     order by u.provider;
end $$;
revoke all on function public.ai_spend_this_month() from public, anon;
grant execute on function public.ai_spend_this_month() to authenticated;
