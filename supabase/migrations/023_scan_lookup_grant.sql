-- Calorie Manager: Scan can look a barcode up (ticket #18)
-- usda_lookup_gtin (migration 003) was revoked from anon and authenticated with the other
-- usda_* functions, and 006 replaced it without restoring a grant. The app calls it as a
-- signed-in Member, so grant execute to authenticated only. It still checks the Food
-- Library of the caller's Household first and asks USDA only when that misses.
-- anon keeps no access.
grant execute on function public.usda_lookup_gtin(text) to authenticated;
