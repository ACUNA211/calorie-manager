-- Calorie Manager: Scan tries every padding of a barcode (carried over from the live project)
-- USDA stores gtinUpc as typed by the brand: a 12-digit UPC-A may be indexed as 12, 13 or
-- 14 digits, and its search matches the query text, so one query can miss. The live project
-- got this fix on 2026-10-17 (its migration gtin_lookup_variants, from the old artifact
-- branch); 006 replaced usda_lookup_gtin without it. This keeps 006's Household filter and
-- adds the retries: the code as scanned, then padded to 12, 13 and 14 digits, each tried once.
-- create or replace keeps 023's grant to authenticated.
create or replace function public.usda_lookup_gtin(p_code text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  digits text := regexp_replace(p_code, '\D', '', 'g');
  code text := ltrim(digits, '0');
  v_hh bigint;
  q text;
  tried text[] := '{}';
  j jsonb;
  hit jsonb;
  local_id bigint;
begin
  if code = '' then return null; end if;
  v_hh := private.current_household_id();
  select id into local_id from public.foods
  where household_id = v_hh and ltrim(gtin, '0') = code limit 1;
  if local_id is not null then
    return jsonb_build_object('food_id', local_id);
  end if;
  foreach q in array array[digits, lpad(code, 12, '0'), lpad(code, 13, '0'), lpad(code, 14, '0')] loop
    continue when length(q) > 14 or ltrim(q, '0') <> code or q = any(tried);
    tried := tried || q;
    j := public.usda_get('foods/search?pageSize=10&dataType=Branded&query=' || q);
    hit := (select public.usda_hit(f) from jsonb_array_elements(j->'foods') f
            where ltrim(f->>'gtinUpc', '0') = code
            order by f->>'publishedDate' desc nulls last limit 1);
    if hit is not null then return hit; end if;
  end loop;
  return null;
end $$;
