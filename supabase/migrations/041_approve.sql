-- Calorie Manager: Approve (ticket #45)
-- The Owner always may approve a draft Meal Plan. The Owner can also allow individual adult
-- Members to (members.can_approve). Dependents have no login, so the flag means nothing for them.
-- Members rows are write-protected (005), so the flag changes only through
-- set_member_can_approve(), which checks the caller is the Owner of that Household.
--
-- plan_approve() is the one way to approve: it checks the caller may, then marks the plan
-- approved. It is safe to call twice: the second call changes nothing, except that approving an
-- already-approved plan that was edited since clears changed_since_approval (the 039 trigger
-- clears it only when the status changes, so this function does it itself).
--
-- Shopping list hook (ticket 46): approval is the trigger. plan_approve() ends by calling
-- public.sync_shopping_list(plan_id), the existing function from 002/006 that adds lines for
-- what the plan needs minus what the Pantry holds; ticket 46 adapts that function. Only
-- the line marked "HOOK (46)" below needs to change if 46 wants a different entry point.
--
-- The old approve_meal_plan(bigint) (002) let any signed-in user approve; it is shut to clients.
-- Run against a LOCAL stack only; the test is supabase/tests/approve_test.sql.

alter table public.members
  add column can_approve boolean not null default false;
comment on column public.members.can_approve is
  'True when the Owner allows this Member to approve the Meal Plan. The Owner may always approve.';

-- Whether the caller may approve (Owner, or a Member the Owner allowed). Used to show the button.
create or replace function public.plan_can_approve()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select m.role = 'owner' or (m.role = 'member' and m.can_approve)
      from public.members m
     where m.user_id = auth.uid()
  ), false);
$$;
revoke all on function public.plan_can_approve() from public, anon;
grant execute on function public.plan_can_approve() to authenticated;

-- Owner only: allow or disallow one adult Member of the Owner's Household to approve.
create or replace function public.set_member_can_approve(p_member_id bigint, p_allowed boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_household bigint;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  select m.household_id into v_household
    from public.members m
   where m.user_id = auth.uid() and m.role = 'owner';
  if v_household is null then
    raise exception 'Only the Owner can allow approving' using errcode = '42501';
  end if;
  if p_allowed is null then
    raise exception 'Allowed must be true or false' using errcode = '22023';
  end if;
  update public.members set can_approve = p_allowed
   where id = p_member_id and household_id = v_household and role = 'member';
  if not found then
    raise exception 'Member not found' using errcode = '42501';
  end if;
end $$;
revoke all on function public.set_member_can_approve(bigint, boolean) from public, anon;
grant execute on function public.set_member_can_approve(bigint, boolean) to authenticated;

-- Approves a Meal Plan. Returns {status, newly_approved, shopping_lines_added}.
create or replace function public.plan_approve(p_plan_id bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_status text;
  v_changed boolean;
  v_newly boolean := false;
  v_lines integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in to approve the plan' using errcode = '28000';
  end if;
  select mp.status, mp.changed_since_approval into v_status, v_changed
    from public.meal_plans mp
   where mp.id = p_plan_id and mp.household_id in (select private.my_household_ids());
  if v_status is null then
    raise exception 'Plan not found' using errcode = '42501';
  end if;
  if not public.plan_can_approve() then
    raise exception 'Only the Owner, or a Member the Owner allows, can approve the plan'
      using errcode = '42501';
  end if;

  if v_status = 'draft' then
    update public.meal_plans
       set status = 'approved', approved_at = coalesce(approved_at, now())
     where id = p_plan_id;
    v_newly := true;
  elsif v_changed then
    -- Re-approving an edited plan: the status does not change, so clear the flag here.
    update public.meal_plans set changed_since_approval = false where id = p_plan_id;
  end if;

  -- HOOK (46): approval builds the Shopping list. It adds only what is still short, so calling it
  -- again adds nothing.
  if v_newly or v_changed then
    v_lines := public.sync_shopping_list(p_plan_id);
  end if;

  return jsonb_build_object('status', 'approved', 'newly_approved', v_newly,
                            'shopping_lines_added', v_lines);
end $$;
revoke all on function public.plan_approve(bigint) from public, anon;
grant execute on function public.plan_approve(bigint) to authenticated;

-- Shut the old ungated entry point.
revoke all on function public.approve_meal_plan(bigint) from public, anon, authenticated;
