-- Calorie Manager: Dependents (ticket #07)
-- A Dependent is a Member with no login (role 'dependent', user_id null; 005 enforces
-- that, so a Dependent can never sign in). Only the Owner adds, renames or removes one.
-- Every adult in the Household can read and write a Dependent's rows (meal times,
-- portions, Calorie Log, Targets): 007 already covers that through private.my_member_ids(),
-- so no policy changes here. Members rows stay write-protected; these functions are the
-- only way to change them.
--
-- Removing a Dependent deletes their Meal Times, Portions, Calorie Log entries and Targets
-- (cascade from 007). The app asks for confirmation before it calls remove_dependent.

-- Adds a Dependent to the caller's Household (the caller must be its Owner)
create or replace function public.add_dependent(p_name text)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_household bigint;
  v_name text := trim(coalesce(p_name, ''));
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'Sign in before adding a Dependent' using errcode = '28000';
  end if;
  select m.household_id into v_household
    from public.members m
   where m.user_id = v_uid and m.role = 'owner';
  if v_household is null then
    raise exception 'Only the Owner can add a Dependent' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'A Dependent needs a name' using errcode = '23514';
  end if;
  if char_length(v_name) > 60 then
    raise exception 'A name can be at most 60 characters' using errcode = '22001';
  end if;
  insert into public.members (household_id, user_id, display_name, role)
    values (v_household, null, v_name, 'dependent')
    returning id into v_id;
  return v_id;
end $$;
revoke all on function public.add_dependent(text) from public, anon;
grant execute on function public.add_dependent(text) to authenticated;

-- Renames one of the caller's Household's Dependents (the caller must be its Owner)
create or replace function public.rename_dependent(p_member_id bigint, p_name text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
begin
  if v_name = '' then
    raise exception 'A Dependent needs a name' using errcode = '23514';
  end if;
  if char_length(v_name) > 60 then
    raise exception 'A name can be at most 60 characters' using errcode = '22001';
  end if;
  update public.members m
     set display_name = v_name
   where m.id = p_member_id
     and m.role = 'dependent'
     and m.household_id in (select private.my_owned_household_ids());
  if not found then
    raise exception 'Only the Owner can rename a Dependent in this Household' using errcode = '42501';
  end if;
end $$;
revoke all on function public.rename_dependent(bigint, text) from public, anon;
grant execute on function public.rename_dependent(bigint, text) to authenticated;

-- Removes one of the caller's Household's Dependents, and their data (the caller must be its Owner)
create or replace function public.remove_dependent(p_member_id bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.members m
   where m.id = p_member_id
     and m.role = 'dependent'
     and m.household_id in (select private.my_owned_household_ids());
  if not found then
    raise exception 'Only the Owner can remove a Dependent in this Household' using errcode = '42501';
  end if;
end $$;
revoke all on function public.remove_dependent(bigint) from public, anon;
grant execute on function public.remove_dependent(bigint) to authenticated;
