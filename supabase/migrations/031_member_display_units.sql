-- Calorie Manager: display units (ticket #11)
-- Each Member chooses metric (g, kg) or US (oz, lb) units for what the app shows and types.
-- The default is US. Stored values stay in grams and kilograms; only the display changes
-- (CONTEXT.md, ground rules). The Member's own setting, and the setting of a Dependent is
-- changed by any adult in its Household, the same rule as the rest of a Member's data (007).
--
-- Run against a LOCAL stack only; the tests are ticket #69.

-- 1. The column --------------------------------------------------------------------
alter table public.members
  add column display_units text not null default 'us'
    constraint members_display_units_check check (display_units in ('metric', 'us'));

-- 2. Who may change it --------------------------------------------------------------
-- The app never writes members directly (005 revokes it), so only this one column is granted
-- back, and only on rows the caller may act for: their own Member, or a Dependent of their
-- Household (private.my_member_ids, from 007). Nothing else on members opens up.
grant update (display_units) on public.members to authenticated;

create policy members_update_display_units on public.members
  for update to authenticated
  using (id in (select private.my_member_ids()))
  with check (id in (select private.my_member_ids()));
