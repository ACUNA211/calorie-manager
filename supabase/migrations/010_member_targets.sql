-- Calorie Manager: Targets by hand (ticket #10)
-- Adds the Targets that member_settings does not hold yet: the protein floor and the
-- optional carb and fat ranges, in grams. All are nullable: a cleared Target is NULL.
-- The Calorie Target and the Planning band already exist (007) and are not changed.
-- RLS needs no change: the policy from 007 already covers every column of the row.

alter table public.member_settings
  add column protein_floor_g integer check (protein_floor_g >= 0),
  add column carb_low_g integer check (carb_low_g >= 0),
  add column carb_high_g integer check (carb_high_g >= 0),
  add column fat_low_g integer check (fat_low_g >= 0),
  add column fat_high_g integer check (fat_high_g >= 0),
  add constraint member_settings_carb_range_check check (
    (carb_low_g is null and carb_high_g is null)
    or (carb_low_g is not null and carb_high_g is not null and carb_low_g <= carb_high_g)
  ),
  add constraint member_settings_fat_range_check check (
    (fat_low_g is null and fat_high_g is null)
    or (fat_low_g is not null and fat_high_g is not null and fat_low_g <= fat_high_g)
  );
