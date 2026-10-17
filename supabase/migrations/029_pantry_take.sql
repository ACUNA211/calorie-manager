-- Calorie Manager: eating a Pantry food takes it off the Pantry (ticket #27)
-- CONTEXT.md "Pantry": the Pantry goes down when a Pantry food is eaten on its own. The
-- Today Eaten button logs the food and calls this function. It never takes more than is
-- held (the Pantry never goes below zero) and it does not fail when the food is not in the
-- Pantry: it then takes nothing and returns 0.
--
-- Run against a LOCAL stack only; the tests are ticket #69.

-- Takes up to p_grams of a food out of the caller's Household Pantry. Runs under a row lock,
-- as pantry_correct does. Returns the grams actually taken (0 when the food is not there or
-- the Pantry holds none), so an Undo can put back exactly that much with pantry_add.
create or replace function public.pantry_take(p_food_id bigint, p_grams numeric)
returns numeric
language plpgsql security definer set search_path = ''
as $$
declare
  v_household bigint := private.current_household_id();
  v_item_id bigint;
  v_current numeric(10,1);
  v_taken numeric(10,1);
begin
  if p_food_id is null then
    raise exception 'Choose a food' using errcode = '22023';
  end if;
  if p_grams is null or round(p_grams, 1) <= 0 or p_grams > 100000 then
    raise exception 'Amount must be more than 0 g and at most 100000 g' using errcode = '22023';
  end if;

  select pi.id, pi.grams into v_item_id, v_current
    from public.pantry_items pi
    where pi.household_id = v_household and pi.food_id = p_food_id
    for update;
  if not found then
    return 0;
  end if;

  v_taken := least(v_current, round(p_grams, 1));
  if v_taken <= 0 then
    return 0;
  end if;

  update public.pantry_items
    set grams = v_current - v_taken, updated_at = now()
    where id = v_item_id;
  return v_taken;
end $$;

revoke all on function public.pantry_take(bigint, numeric) from public, anon;
grant execute on function public.pantry_take(bigint, numeric) to authenticated;
