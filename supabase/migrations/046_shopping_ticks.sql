-- Calorie Manager: Bought / Have it on the Shopping list, migration 046 (ticket #47)
-- CONTEXT.md "Shopping list": a line is ticked Bought (adds its amount to the Pantry) or Have it
-- (corrects the Pantry to say it is there). Ticked lines are never unticked, except Undo for a few
-- seconds after the tick, which reverses exactly what the tick changed.
--
--   shopping_tick(line, kind, grams)  one call per tick, so it can be queued offline (ticket 48).
--     bought   adds the line's grams (or p_grams, the real package weight a Scan finds, ticket 49)
--     have_it  raises the Pantry to at least the line's need (need_grams, else grams); never lowers it
--   Both mark the line purchased and record what they changed in shopping_ticks. A line that is
--   already ticked is left alone (returns applied = false), so two Members ticking the same line,
--   or a queued tick replayed, never doubles the Pantry. A line with no food only gets ticked.
--   shopping_untick(line)  allowed for UNDO_SECONDS after the tick: takes back the amount the tick
--     added (not a saved snapshot, so later Pantry changes by others stay), unticks the line and
--     forgets the tick. Afterwards the line is final.
--   A trigger stops any other route (a direct update) from unticking a line.
--
-- Run against a LOCAL stack only: `supabase start`, `supabase db reset`, then `supabase test db`.
-- The test is supabase/tests/shopping_ticks_test.sql. Not run when written.

create table public.shopping_ticks (
  line_id bigint primary key references public.grocery_list(id) on delete cascade,
  household_id bigint not null references public.households(id) on delete cascade,
  kind text not null check (kind in ('bought', 'have_it')),
  food_id bigint references public.foods(id) on delete set null,
  pantry_delta numeric not null default 0,
  pantry_created boolean not null default false,
  ticked_by uuid default auth.uid(),
  ticked_at timestamptz not null default now()
);
create index shopping_ticks_household_idx on public.shopping_ticks (household_id);
alter table public.shopping_ticks enable row level security;
revoke all on public.shopping_ticks from anon;
revoke insert, update, delete on public.shopping_ticks from authenticated;
create policy shopping_ticks_household_select on public.shopping_ticks
  for select to authenticated
  using (household_id in (select private.my_household_ids()));

-- A ticked line stays ticked, unless shopping_untick says otherwise inside its own transaction.
create function private.keep_ticked() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.purchased and not new.purchased
     and coalesce(current_setting('app.shopping_untick', true), '') <> '1' then
    raise exception 'A ticked line cannot be unticked' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger grocery_list_keep_ticked before update of purchased on public.grocery_list
  for each row execute function private.keep_ticked();

create function public.shopping_tick(p_line_id bigint, p_kind text, p_grams numeric default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_household bigint := private.current_household_id();
  l record;
  v_before numeric;
  v_after numeric;
  v_amount numeric;
  v_created boolean := false;
  v_rows integer;
begin
  if p_kind not in ('bought', 'have_it') then
    raise exception 'Unknown tick %', p_kind using errcode = '22023';
  end if;
  if p_grams is not null and (round(p_grams, 1) <= 0 or p_grams > 100000) then
    raise exception 'Amount must be more than 0 g and at most 100000 g' using errcode = '22023';
  end if;
  select g.id, g.food_id, g.grams, g.need_grams, g.purchased into l
    from public.grocery_list g
    where g.id = p_line_id and g.household_id = v_household
    for update;
  if not found then
    raise exception 'That line is not in your Household' using errcode = '42501';
  end if;
  if l.purchased then
    return jsonb_build_object('applied', false, 'line_id', l.id);
  end if;

  v_amount := coalesce(p_grams, l.grams);
  if l.food_id is not null and coalesce(v_amount, 0) > 0 then
    insert into public.pantry_items (household_id, food_id, grams)
      values (v_household, l.food_id, 0)
    on conflict (household_id, food_id) do nothing;
    get diagnostics v_rows = row_count;
    v_created := v_rows > 0;
    select pi.grams into v_before from public.pantry_items pi
      where pi.household_id = v_household and pi.food_id = l.food_id for update;
    if p_kind = 'bought' then
      v_after := least(v_before + round(v_amount, 1), 100000);
    else
      v_after := greatest(v_before, least(round(coalesce(p_grams, l.need_grams, l.grams), 1), 100000));
    end if;
    update public.pantry_items set grams = v_after, updated_at = now()
      where household_id = v_household and food_id = l.food_id;
  else
    v_before := 0; v_after := 0;
  end if;

  update public.grocery_list set purchased = true where id = l.id;
  insert into public.shopping_ticks (line_id, household_id, kind, food_id, pantry_delta, pantry_created)
    values (l.id, v_household, p_kind, l.food_id, v_after - v_before, v_created);
  return jsonb_build_object('applied', true, 'line_id', l.id, 'pantry_grams', v_after,
                            'pantry_delta', v_after - v_before);
end $$;

-- Undo: only for the person's Household and only for this many seconds after the tick.
create function public.shopping_untick(p_line_id bigint)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c_undo_seconds constant integer := 10;
  v_household bigint := private.current_household_id();
  t record;
  v_now numeric;
begin
  select st.* into t from public.shopping_ticks st
    where st.line_id = p_line_id and st.household_id = v_household
    for update;
  if not found then
    raise exception 'That line has no tick to undo' using errcode = '42501';
  end if;
  if now() - t.ticked_at > make_interval(secs => c_undo_seconds) then
    raise exception 'The undo time has passed' using errcode = '42501';
  end if;

  if t.food_id is not null then
    select pi.grams into v_now from public.pantry_items pi
      where pi.household_id = v_household and pi.food_id = t.food_id for update;
    if found then
      v_now := greatest(v_now - t.pantry_delta, 0);
      if t.pantry_created and v_now = 0 then
        delete from public.pantry_items where household_id = v_household and food_id = t.food_id;
      else
        update public.pantry_items set grams = v_now, updated_at = now()
          where household_id = v_household and food_id = t.food_id;
      end if;
    end if;
  end if;

  perform set_config('app.shopping_untick', '1', true);
  update public.grocery_list set purchased = false where id = p_line_id;
  perform set_config('app.shopping_untick', '', true);
  delete from public.shopping_ticks where line_id = p_line_id;
  return jsonb_build_object('line_id', p_line_id, 'pantry_grams', v_now);
end $$;

revoke all on function public.shopping_tick(bigint, text, numeric) from public, anon;
revoke all on function public.shopping_untick(bigint) from public, anon;
grant execute on function public.shopping_tick(bigint, text, numeric) to authenticated;
grant execute on function public.shopping_untick(bigint) to authenticated;
