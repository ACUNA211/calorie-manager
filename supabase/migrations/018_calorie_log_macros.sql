-- Calorie Manager: macros on the Calorie Log (ticket #23, Today: log a food)
-- A logged entry keeps its protein, carbs and fat next to its calories, so the day bar can
-- show macros against Targets. All three are nullable: NULL means the food had no figure
-- (a USDA search hit has none until it is saved), never 0. The existing row-level security
-- on calorie_log (007) already covers the new columns, so no policy changes here.
-- Run against a LOCAL stack only; the tests are ticket #69.

alter table public.calorie_log
  add column protein_g numeric check (protein_g >= 0),
  add column carbs_g numeric check (carbs_g >= 0),
  add column fat_g numeric check (fat_g >= 0);

comment on column public.calorie_log.protein_g is 'Grams of protein in this entry. NULL when the food has no figure.';
comment on column public.calorie_log.carbs_g is 'Grams of carbohydrate in this entry. NULL when the food has no figure.';
comment on column public.calorie_log.fat_g is 'Grams of fat in this entry. NULL when the food has no figure.';
