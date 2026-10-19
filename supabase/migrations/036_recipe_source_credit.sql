-- Calorie Manager: where an imported Recipe came from (ticket #67)
-- A Recipe imported from USDA MyPlate Kitchen keeps the source's name and the link to the
-- original page. Both are null for Recipes typed in. source_url is also how the one-off
-- import skips a Recipe it already added.
alter table public.recipes
  add column source_name text,
  add column source_url text check (source_url is null or source_url ~ '^https?://');

create unique index recipes_household_source_url_key
  on public.recipes (household_id, source_url) where source_url is not null;
