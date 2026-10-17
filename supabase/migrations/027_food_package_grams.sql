-- Calorie Manager: the label weight of one package of a food (ticket #26)
-- Scan into the Pantry adds one package at its label weight. A food's serving data does
-- not always say how much the package weighs, so the Household can set it once; the app
-- then remembers it on the food for every later scan.
--
-- Run against a LOCAL stack only; the tests are ticket #69.

-- 1. The column (NULL until someone sets it) ---------------------------------------
alter table public.foods
  add column package_grams numeric
  check (package_grams is null or (package_grams > 0 and package_grams <= 100000));

-- 2. Set a food's package weight -----------------------------------------------------
-- Any Member may set it (every Member edits the Food Library, as in CONTEXT.md). Only a
-- food in the caller's own Household can be changed. Returns the stored weight.
create or replace function public.set_package_grams(p_food_id bigint, p_grams numeric)
returns numeric
language plpgsql security definer set search_path = ''
as $$
declare
  v_household bigint := private.current_household_id();
  v_grams numeric(10,1);
begin
  if p_food_id is null then
    raise exception 'Choose a food' using errcode = '22023';
  end if;
  if p_grams is null or round(p_grams, 1) <= 0 or p_grams > 100000 then
    raise exception 'Package weight must be more than 0 g and at most 100000 g' using errcode = '22023';
  end if;
  v_grams := round(p_grams, 1);

  update public.foods
    set package_grams = v_grams
    where id = p_food_id and household_id = v_household;
  if not found then
    raise exception 'That food is not in your Food Library' using errcode = '42501';
  end if;
  return v_grams;
end $$;

revoke all on function public.set_package_grams(bigint, numeric) from public, anon;
grant execute on function public.set_package_grams(bigint, numeric) to authenticated;
