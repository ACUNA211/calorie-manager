-- Calorie Manager: the Foods search and save screens call usda_search and usda_save as a
-- signed-in Member (web/src/lib/foods.js, used by Foods, Today, Pantry and Recipes).
-- Migration 003 revoked execute on every usda_* function from anon and authenticated, and
-- 006 and 009 replaced usda_save with create-or-replace, which keeps that revoke. Only
-- usda_lookup_gtin was re-granted (023), so those two calls failed with permission denied.
--
-- Why these two are safe for any signed-in user:
-- - usda_search only asks USDA (through usda_get, which runs as the function owner) and
--   returns USDA hits. It reads no Household data and never returns the USDA key.
-- - usda_save puts the food into the caller's own Household: it takes the Household from
--   private.current_household_id(), which raises 'Create or join a Household first' for a
--   signed-in user with no Household, and it checks for an existing copy in that Household only.
--
-- Still revoked: usda_get (the raw HTTP helper that holds the USDA key), usda_nutrient and
-- the other helpers, and everything for anon. Calls from inside these security definer
-- functions run as the owner, so they do not need a grant to usda_get.
revoke all on function public.usda_search(text, int) from public, anon;
revoke all on function public.usda_save(bigint) from public, anon;
grant execute on function public.usda_search(text, int) to authenticated;
grant execute on function public.usda_save(bigint) to authenticated;
