-- Calorie Manager: Spanish food names (ticket #16)
-- Each Food Library food has an English name (foods.name) and a Spanish name (foods.name_es).
-- The Spanish name is filled once, when a food is saved (or by the one-time backfill), by the
-- translate-food-name Edge Function through the AI cap helper (ADR 0002). A failed
-- translation leaves name_es NULL and the food still saves.
--
-- A Member's own Spanish name is never overwritten:
--   * name_es_edited_by_member turns on when any non-translator write changes name_es (or
--     sets it on insert), and a non-translator write cannot turn it off.
--   * Only public.apply_food_spanish_name (service role) writes name_es from the translator,
--     and only while the flag is off.
-- name_es_attempted_at records that a translation was tried, so the backfill does not retry
-- a food that failed. Clear it to retry.

-- 1. Columns -------------------------------------------------------------------------
alter table public.foods
  add column name_es text check (name_es is null or length(trim(name_es)) > 0),
  add column name_es_edited_by_member boolean not null default false,
  add column name_es_attempted_at timestamptz;

-- 2. Guard: keeps the flag honest ----------------------------------------------------
-- The translator sets the transaction-local setting calorie.name_es_source = 'translation'
-- before its write; any other writer is treated as a Member.
create or replace function private.foods_name_es_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_from_translator boolean := coalesce(current_setting('calorie.name_es_source', true), '') = 'translation';
begin
  if tg_op = 'INSERT' then
    -- a Spanish name supplied on insert is the Member's own
    new.name_es_edited_by_member := new.name_es_edited_by_member or (new.name_es is not null);
  elsif v_from_translator then
    new.name_es_edited_by_member := old.name_es_edited_by_member;
  else
    new.name_es_edited_by_member := old.name_es_edited_by_member
      or (new.name_es is distinct from old.name_es);
  end if;
  return new;
end $$;
revoke all on function private.foods_name_es_guard() from public, anon, authenticated;

create trigger foods_name_es_guard
before insert or update on public.foods
for each row execute function private.foods_name_es_guard();

-- 3. The translator's only write path ------------------------------------------------
-- p_name NULL means the translation failed: the attempt is recorded and name_es is kept.
-- Returns true when a food row was updated (false for an unknown food or one a Member edited).
create or replace function public.apply_food_spanish_name(p_food_id bigint, p_name text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := nullif(btrim(p_name), '');
  v_rows int;
begin
  perform set_config('calorie.name_es_source', 'translation', true);
  update public.foods
     set name_es = coalesce(v_name, name_es),
         name_es_attempted_at = now()
   where id = p_food_id
     and name_es_edited_by_member = false;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end $$;

revoke all on function public.apply_food_spanish_name(bigint, text) from public, anon, authenticated;
grant execute on function public.apply_food_spanish_name(bigint, text) to service_role;

-- 4. Backfill note ---------------------------------------------------------------------
-- Existing foods start with name_es NULL and name_es_attempted_at NULL, so the backfill
-- (the translate-food-name function in backfill mode) picks them up once. No data is
-- rewritten here.
