-- Calorie Manager: a food typed in from its Nutrition Facts label (ticket #20)
-- When neither the Food Library, USDA nor Open Food Facts knows a barcode, a Member types
-- the label in. The food is saved to the caller's Household with source = 'label' (already
-- allowed by the foods.source check in 001) and the scanned barcode in gtin, so the next
-- scan finds it in the Food Library first (usda_lookup_gtin, migration 006).
--
-- The app converts the per-serving values to per 100 g before the call (web/src/lib/label.js).
-- The function checks the values again, because the database is the last line of defence.
--
-- Run against a LOCAL stack only; the tests are ticket #69.

-- 1. Save a typed label food into the caller's Household ---------------------------------
-- Returns the Food Library id. If the Household already has this barcode, that food is
-- returned and nothing is added (as usda_save does), so a double tap saves once.
create or replace function public.save_label_food(
  p_gtin text,
  p_name text,
  p_brand text,
  p_serving_grams numeric,
  p_kcal_per_100g numeric,
  p_protein_g numeric,
  p_carbs_g numeric,
  p_fat_g numeric,
  p_fibre_g numeric,
  p_sugars_g numeric,
  p_sodium_mg numeric
)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_household bigint := private.current_household_id();
  v_name text := btrim(coalesce(p_name, ''));
  v_brand text := nullif(btrim(coalesce(p_brand, '')), '');
  v_gtin text;
  v_existing bigint;
  v_id bigint;
begin
  if p_gtin is null or p_gtin !~ '^[0-9]{8,14}$' then
    raise exception 'Barcode must be 8 to 14 digits' using errcode = '22023';
  end if;
  v_gtin := lpad(p_gtin, 14, '0');

  if v_name = '' or length(v_name) > 200 then
    raise exception 'Name must be 1 to 200 characters' using errcode = '22023';
  end if;
  if p_serving_grams is null or p_serving_grams <= 0 or p_serving_grams > 5000 then
    raise exception 'Serving size must be more than 0 g and at most 5000 g' using errcode = '22023';
  end if;
  if p_kcal_per_100g is null or p_kcal_per_100g < 0 or p_kcal_per_100g > 1000 then
    raise exception 'Calories per 100 g must be between 0 and 1000' using errcode = '22023';
  end if;
  if p_protein_g is null or p_carbs_g is null or p_fat_g is null then
    raise exception 'Protein, carbs and fat are required' using errcode = '22023';
  end if;
  if p_protein_g < 0 or p_protein_g > 100 or p_carbs_g < 0 or p_carbs_g > 100
     or p_fat_g < 0 or p_fat_g > 100
     or coalesce(p_fibre_g, 0) < 0 or coalesce(p_fibre_g, 0) > 100
     or coalesce(p_sugars_g, 0) < 0 or coalesce(p_sugars_g, 0) > 100
     or coalesce(p_sodium_mg, 0) < 0 or coalesce(p_sodium_mg, 0) > 40000 then
    raise exception 'A nutrient per 100 g is out of range' using errcode = '22023';
  end if;

  select id into v_existing from public.foods
    where household_id = v_household and ltrim(gtin, '0') = ltrim(v_gtin, '0')
    limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.foods (
    household_id, name, brand, source, source_id, gtin, kcal_per_100g, servings,
    protein_g, carbs_g, fat_g, fibre_g, sugars_g, sodium_mg, store_section
  ) values (
    v_household, v_name, v_brand, 'label', null, v_gtin, round(p_kcal_per_100g, 1),
    jsonb_build_array(jsonb_build_object('grams', round(p_serving_grams, 1))),
    round(p_protein_g, 1), round(p_carbs_g, 1), round(p_fat_g, 1),
    round(p_fibre_g, 1), round(p_sugars_g, 1), round(p_sodium_mg, 1), 'Other'
  )
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.save_label_food(text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.save_label_food(text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric) to authenticated;
