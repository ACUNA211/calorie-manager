-- Calorie Manager: household invite links (ticket #06)
-- The Owner creates a link (valid 7 days by default). Someone who opens it sees only the
-- Household name and status (peek_invite), then accept_invite adds them as a Member.
-- A link is single-use: once used, revoked or expired it joins nobody. Only the Owner
-- can create, list or revoke links, enforced by row-level security. Writes to used_by,
-- used_at and expires_at happen only inside accept_invite or the column default.

create table public.household_invites (
  id bigint generated always as identity primary key,
  -- 244 random bits from two v4 UUIDs, as 64 hex characters
  token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  household_id bigint not null references public.households(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  check ((used_by is null) = (used_at is null))
);

create index household_invites_household_idx on public.household_invites (household_id);

-- Household ids the caller owns. SECURITY DEFINER so the policies can read members
-- without recursing into members' own RLS. Empty search_path: every name is qualified.
create or replace function private.my_owned_household_ids()
returns setof bigint
language sql stable security definer set search_path = ''
as $$
  select m.household_id from public.members m
  where m.user_id = auth.uid() and m.role = 'owner';
$$;
revoke all on function private.my_owned_household_ids() from public, anon;
grant execute on function private.my_owned_household_ids() to authenticated;

-- Column-level grants: clients may insert only household_id (the rest comes from defaults)
-- and may update only revoked_at.
revoke all on public.household_invites from public, anon, authenticated;
grant select on public.household_invites to authenticated;
grant insert (household_id) on public.household_invites to authenticated;
grant update (revoked_at) on public.household_invites to authenticated;

alter table public.household_invites enable row level security;

create policy household_invites_owner_select on public.household_invites
  for select to authenticated
  using (household_id in (select private.my_owned_household_ids()));

create policy household_invites_owner_insert on public.household_invites
  for insert to authenticated
  with check (
    household_id in (select private.my_owned_household_ids())
    and created_by = auth.uid()
  );

-- The Owner can only revoke: the new row must have revoked_at set
create policy household_invites_owner_revoke on public.household_invites
  for update to authenticated
  using (household_id in (select private.my_owned_household_ids()))
  with check (
    household_id in (select private.my_owned_household_ids())
    and revoked_at is not null
  );

-- Landing screen: the Household name and the link's status, for any token. Returns no row
-- for an unknown token. Status is one of valid, revoked, used, expired.
create or replace function public.peek_invite(p_token text)
returns table (household_name text, status text)
language sql stable security definer set search_path = ''
as $$
  select h.name,
    case
      when i.revoked_at is not null then 'revoked'
      when i.used_at is not null then 'used'
      when i.expires_at <= now() then 'expired'
      else 'valid'
    end
  from public.household_invites i
  join public.households h on h.id = i.household_id
  where i.token = p_token;
$$;
revoke all on function public.peek_invite(text) from public;
grant execute on function public.peek_invite(text) to anon, authenticated;

-- Joins the caller to the invite's Household as a 'member', atomically. Refuses with a
-- message code (invite_not_found, invite_revoked, invite_used, invite_expired,
-- already_in_household) and changes nothing. The row lock stops two people using one link.
create or replace function public.accept_invite(p_token text, p_display_name text default null)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.household_invites%rowtype;
  v_name text;
begin
  if v_uid is null then
    raise exception 'Sign in before accepting an invite' using errcode = '28000';
  end if;

  select * into v_inv from public.household_invites where token = p_token for update;
  if not found then
    raise exception 'invite_not_found' using errcode = 'P0001';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'invite_revoked' using errcode = 'P0001';
  end if;
  if v_inv.used_at is not null then
    raise exception 'invite_used' using errcode = 'P0001';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.members m where m.user_id = v_uid) then
    raise exception 'already_in_household' using errcode = 'P0001';
  end if;

  v_name := nullif(trim(coalesce(p_display_name, '')), '');
  if v_name is null then
    select coalesce(nullif(split_part(u.email, '@', 1), ''), 'Member')
      into v_name from auth.users u where u.id = v_uid;
  end if;

  insert into public.members (household_id, user_id, display_name, role)
    values (v_inv.household_id, v_uid, v_name, 'member');
  update public.household_invites set used_by = v_uid, used_at = now() where id = v_inv.id;
  return v_inv.household_id;
end $$;
revoke all on function public.accept_invite(text, text) from public, anon;
grant execute on function public.accept_invite(text, text) to authenticated;
