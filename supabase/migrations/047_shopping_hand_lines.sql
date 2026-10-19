-- Calorie Manager: hand-added Shopping list lines, migration 047 (ticket #48)
-- CONTEXT.md "Shopping list": any Member can add a line by hand (a food or not, with an optional
-- amount) and every Member of the Household sees it. A phone with no signal queues the add and
-- sends it later (the queue of ticket 34), so the add carries an id made on the phone:
--
--   shopping_add_line(client_id, name, food, grams, text)
--     creates a 'hand' line in the caller's Household. Sending the same client_id again (a replayed
--     queue, a double tap) returns the line that is already there and adds nothing
--     (created = false). A client_id already used by another Household is refused.
--
-- Ticking offline needs nothing new: a queued tick is replayed through shopping_tick (046), which
-- ticks a line once (applied = false after that), so two Members ticking the same line offline
-- cannot double the Pantry.
--
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`.
-- The test is supabase/tests/shopping_hand_lines_test.sql. Not run when written.

alter table public.grocery_list add column client_id uuid;
create unique index grocery_list_client_id_key on public.grocery_list (client_id)
  where client_id is not null;

create function public.shopping_add_line(
  p_client_id uuid,
  p_name text,
  p_food_id bigint default null,
  p_grams numeric default null,
  p_text text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_household bigint := private.current_household_id();
  v_name text := btrim(coalesce(p_name, ''));
  v_text text := nullif(btrim(coalesce(p_text, '')), '');
  v_section text := 'Other';
  v_grams numeric := null;
  v_food_name text;
  v_existing record;
  v_id bigint;
begin
  if p_client_id is null then
    raise exception 'A line needs an id' using errcode = '22023';
  end if;
  -- a replay finds its line first, whatever else changed since
  select g.id, g.household_id into v_existing from public.grocery_list g where g.client_id = p_client_id;
  if found then
    if v_existing.household_id is distinct from v_household then
      raise exception 'That id belongs to another Household' using errcode = '42501';
    end if;
    return jsonb_build_object('line_id', v_existing.id, 'created', false);
  end if;

  if p_food_id is not null then
    select f.name, f.store_section into v_food_name, v_section
      from public.foods f where f.id = p_food_id and f.household_id = v_household;
    if not found then
      raise exception 'That food is not in your Household' using errcode = '42501';
    end if;
    if v_name = '' then v_name := v_food_name; end if;
    v_section := coalesce(v_section, 'Other');
  end if;
  if v_name = '' then
    raise exception 'A line needs a name' using errcode = '22023';
  end if;
  if char_length(v_name) > 120 or char_length(coalesce(v_text, '')) > 120 then
    raise exception 'Name and amount can be at most 120 characters' using errcode = '22023';
  end if;
  if p_grams is not null then
    if round(p_grams, 1) <= 0 or p_grams > 100000 then
      raise exception 'Amount must be more than 0 g and at most 100000 g' using errcode = '22023';
    end if;
    if p_food_id is null then
      raise exception 'An amount in grams needs a food' using errcode = '22023';
    end if;
    v_grams := round(p_grams, 1);
    v_text := coalesce(v_text, v_grams || ' g');
  end if;

  insert into public.grocery_list (item_name, quantity_needed, purchased, food_id, source, grams,
                                   store_section, household_id, client_id)
  values (v_name, v_text, false, p_food_id, 'hand', v_grams, v_section, v_household, p_client_id)
  returning id into v_id;
  return jsonb_build_object('line_id', v_id, 'created', true);
exception when unique_violation then
  -- two sends of the same id at the same moment: the second finds the first one's line
  select g.id into v_id from public.grocery_list g
    where g.client_id = p_client_id and g.household_id = v_household;
  if v_id is null then raise; end if;
  return jsonb_build_object('line_id', v_id, 'created', false);
end $$;

revoke all on function public.shopping_add_line(uuid, text, bigint, numeric, text) from public, anon;
grant execute on function public.shopping_add_line(uuid, text, bigint, numeric, text) to authenticated;
