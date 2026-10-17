-- Calorie Manager: the Household's Pantry (ticket #25)
-- The food at home, shared by every Member of a Household (CONTEXT.md "Pantry", ADR 0002).
-- One row per food per Household, with its amount in grams. Units come with ticket #11.
--
-- Writes go through two functions, never direct inserts or updates:
--   pantry_add(food, grams)      adds to the food's amount, creating its row if needed
--   pantry_correct(item, action) "used_up" sets zero, "half" halves, "set" types an amount
-- A row at zero stays (hidden in the app) so adding the food again just adds to it.
--
-- Run against a LOCAL stack only; the tests are ticket #69.

-- 1. The table -------------------------------------------------------------------
create table public.pantry_items (
  id bigint generated always as identity primary key,
  household_id bigint not null default private.current_household_id()
    references public.households(id) on delete cascade,
  food_id bigint not null references public.foods(id) on delete cascade,
  grams numeric(10,1) not null default 0 check (grams >= 0 and grams <= 100000),
  updated_at timestamptz not null default now(),
  constraint pantry_items_household_food_key unique (household_id, food_id)
);
create index pantry_items_household_idx on public.pantry_items (household_id);

-- 2. Row-level security and grants ----------------------------------------------
alter table public.pantry_items enable row level security;
revoke all on public.pantry_items from anon;
revoke insert, update, delete on public.pantry_items from authenticated;

create policy pantry_items_household_select on public.pantry_items
  for select to authenticated
  using (household_id in (select private.my_household_ids()));

-- 3. Add an amount of a food to the Pantry --------------------------------------
-- The food must be in the caller's Household (a USDA food is saved to the Food Library
-- first, by the app). Returns the Pantry item's id.
create or replace function public.pantry_add(p_food_id bigint, p_grams numeric)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_household bigint := private.current_household_id();
  v_id bigint;
begin
  if p_food_id is null then
    raise exception 'Choose a food' using errcode = '22023';
  end if;
  if p_grams is null or round(p_grams, 1) <= 0 or p_grams > 100000 then
    raise exception 'Amount must be more than 0 g and at most 100000 g' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.foods f where f.id = p_food_id and f.household_id = v_household
  ) then
    raise exception 'That food is not in your Food Library' using errcode = '42501';
  end if;

  insert into public.pantry_items (household_id, food_id, grams)
    values (v_household, p_food_id, round(p_grams, 1))
  on conflict (household_id, food_id)
    do update set grams = least(public.pantry_items.grams + excluded.grams, 100000),
                  updated_at = now()
  returning id into v_id;
  return v_id;
end $$;

-- 4. Correct a Pantry item's amount ----------------------------------------------
-- Runs under a row lock, so two Members correcting the same item at once do not lose
-- an update. Returns the new amount in grams.
create or replace function public.pantry_correct(
  p_item_id bigint,
  p_action text,
  p_grams numeric default null
)
returns numeric
language plpgsql security definer set search_path = ''
as $$
declare
  v_household bigint := private.current_household_id();
  v_current numeric(10,1);
  v_new numeric(10,1);
begin
  select pi.grams into v_current
    from public.pantry_items pi
    where pi.id = p_item_id and pi.household_id = v_household
    for update;
  if not found then
    raise exception 'That Pantry item is not in your Household' using errcode = '42501';
  end if;

  case p_action
    when 'used_up' then
      v_new := 0;
    when 'half' then
      v_new := round(v_current / 2, 1);
    when 'set' then
      if p_grams is null or round(p_grams, 1) < 0 or p_grams > 100000 then
        raise exception 'Amount must be 0 g or more and at most 100000 g' using errcode = '22023';
      end if;
      v_new := round(p_grams, 1);
    else
      raise exception 'Unknown correction %', p_action using errcode = '22023';
  end case;

  update public.pantry_items
    set grams = v_new, updated_at = now()
    where id = p_item_id;
  return v_new;
end $$;

revoke all on function public.pantry_add(bigint, numeric) from public, anon;
revoke all on function public.pantry_correct(bigint, text, numeric) from public, anon;
grant execute on function public.pantry_add(bigint, numeric) to authenticated;
grant execute on function public.pantry_correct(bigint, text, numeric) to authenticated;
