-- USDA FoodData Central through the database (#15), so the artifact never holds the key.
-- Key lives in Vault as 'usda_api_key' (DEMO_KEY to start: 30 requests/hour; a free
-- data.gov key gives 1,000/hour). Swap it with:
--   select vault.update_secret((select id from vault.secrets where name='usda_api_key'), '<key>');

create or replace function public.usda_get(p_path text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  k text;
  resp extensions.http_response;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'usda_api_key';
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '15000');
  resp := extensions.http_get('https://api.nal.usda.gov/fdc/v1/' || p_path
          || case when p_path like '%?%' then '&' else '?' end || 'api_key=' || coalesce(k, 'DEMO_KEY'));
  if resp.status = 429 then
    raise exception 'USDA rate limit reached; try again later (or add a free data.gov key)';
  elsif resp.status <> 200 then
    raise exception 'USDA returned status %', resp.status;
  end if;
  return resp.content::jsonb;
end $$;

create or replace function public.store_section_for(p_category text)
returns text language sql immutable as $$
  select case
    when p_category is null then 'Other'
    when p_category ~* 'frozen' then 'Frozen'
    when p_category ~* 'vegetable|fruit|produce|salad' and p_category !~* 'canned|juice' then 'Produce'
    when p_category ~* 'beef|pork|poultry|chicken|turkey|sausage|lamb|meat|fish|seafood|finfish|shellfish|bacon|deli' then 'Meat & seafood'
    when p_category ~* 'dairy|egg|cheese|milk|yogurt|cream|butter' then 'Dairy & eggs'
    when p_category ~* 'bak|bread|tortilla|bagel|bun|roll' then 'Bakery & tortillas'
    when p_category ~* 'beverage|drink|juice|soda|water|coffee|tea' then 'Drinks'
    when p_category ~* 'snack|sweet|candy|chip|cookie|cracker|chocolate|dessert' then 'Snacks'
    when p_category ~* 'legume|bean|soup|canned|grain|pasta|rice|cereal|flour' then 'Canned & dry goods'
    when p_category ~* 'oil|fat|spice|herb|sauce|condiment|dressing|gravy|seasoning' then 'Pantry'
    else 'Other' end
$$;

-- kcal per 100 g from a search hit (abridged nutrients) or a full record
create or replace function public.usda_kcal(p_food jsonb)
returns numeric language sql immutable as $$
  select coalesce(
    (select (n->>'value')::numeric from jsonb_array_elements(p_food->'foodNutrients') n
       where (n->>'nutrientId')::int in (1008) or (n->>'nutrientNumber') = '208' limit 1),
    (select (n->>'amount')::numeric from jsonb_array_elements(p_food->'foodNutrients') n
       where (n->'nutrient'->>'id')::int = 1008 limit 1),
    (select coalesce((n->>'value')::numeric, (n->>'amount')::numeric) from jsonb_array_elements(p_food->'foodNutrients') n
       where coalesce((n->>'nutrientId')::int, (n->'nutrient'->>'id')::int) in (2047, 2048) limit 1)
  )
$$;

create or replace function public.usda_hit(f jsonb)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'fdc_id', (f->>'fdcId')::bigint,
    'name', f->>'description',
    'brand', coalesce(nullif(f->>'brandName', ''), nullif(f->>'brandOwner', '')),
    'gtin', nullif(f->>'gtinUpc', ''),
    'data_type', f->>'dataType',
    'category', coalesce(f->>'brandedFoodCategory', f->>'foodCategory'),
    'kcal_per_100g', public.usda_kcal(f),
    'serving_g', case when upper(coalesce(f->>'servingSizeUnit','')) in ('G','GRM','ML','MLT') then (f->>'servingSize')::numeric end,
    'serving_label', nullif(f->>'householdServingFullText', ''))
$$;

create or replace function public.usda_search(p_query text, p_page_size int default 12)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j jsonb;
begin
  j := public.usda_get('foods/search?pageSize=' || least(greatest(p_page_size, 1), 25)
       || '&dataType=Foundation,SR%20Legacy,Survey%20%28FNDDS%29,Branded'
       || '&query=' || extensions.urlencode(p_query));
  return coalesce((select jsonb_agg(public.usda_hit(f)) from jsonb_array_elements(j->'foods') f
                   where public.usda_kcal(f) is not null), '[]'::jsonb);
end $$;

create or replace function public.usda_lookup_gtin(p_code text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  code text := ltrim(regexp_replace(p_code, '\D', '', 'g'), '0');
  j jsonb;
  local_id bigint;
begin
  if code = '' then return null; end if;
  select id into local_id from public.foods where ltrim(gtin, '0') = code limit 1;
  if local_id is not null then
    return jsonb_build_object('food_id', local_id);
  end if;
  j := public.usda_get('foods/search?pageSize=10&dataType=Branded&query=' || code);
  return (select public.usda_hit(f) from jsonb_array_elements(j->'foods') f
          where ltrim(f->>'gtinUpc', '0') = code
          order by f->>'publishedDate' desc nulls last limit 1);
end $$;

-- Save a USDA food to the Food Library (or return the existing one)
create or replace function public.usda_save(p_fdc_id bigint)
returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare
  existing bigint;
  f jsonb;
  kcal numeric;
  computed numeric;
  servings jsonb := '[]';
  cat text;
  new_id bigint;
begin
  select id into existing from public.foods where source = 'usda' and source_id = p_fdc_id::text;
  if existing is not null then return existing; end if;

  f := public.usda_get('food/' || p_fdc_id);
  kcal := public.usda_kcal(f);

  -- sanity check (#01): label typos happen; fall back to 4·carb + 4·protein + 9·fat
  select 4 * coalesce(max(a) filter (where id = 1003), 0)
       + 4 * coalesce(max(a) filter (where id = 1005), 0)
       + 9 * coalesce(max(a) filter (where id = 1004), 0)
    into computed
  from (select (n->'nutrient'->>'id')::int as id, (n->>'amount')::numeric as a
        from jsonb_array_elements(f->'foodNutrients') n) x;
  if kcal is null or (computed > 20 and abs(kcal - computed) / computed > 0.35) then
    kcal := computed;
  end if;
  if kcal is null then raise exception 'USDA food % has no calorie value', p_fdc_id; end if;

  if f->>'dataType' = 'Branded' then
    if upper(coalesce(f->>'servingSizeUnit','')) in ('G','GRM','ML','MLT') and (f->>'servingSize')::numeric > 0 then
      servings := jsonb_build_array(jsonb_build_object(
        'label', coalesce(nullif(f->>'householdServingFullText',''), '1 serving'),
        'grams', round((f->>'servingSize')::numeric, 1)));
    end if;
  else
    select coalesce(jsonb_agg(jsonb_build_object('label', lbl, 'grams', g)), '[]') into servings
    from (
      select distinct on (lbl) lbl, g from (
        select round((p->>'gramWeight')::numeric, 1) as g,
               trim(case when coalesce(p->>'portionDescription','') not in ('', 'Quantity not specified')
                         then p->>'portionDescription'
                         else coalesce(p->>'amount','1') || ' ' ||
                              coalesce(nullif(p->'measureUnit'->>'name', 'undetermined'), p->>'modifier', 'serving') end) as lbl
        from jsonb_array_elements(coalesce(f->'foodPortions', '[]')) p
        where (p->>'gramWeight')::numeric > 0
      ) s
    ) d;
  end if;

  cat := coalesce(f->>'brandedFoodCategory', f->'foodCategory'->>'description', f->>'foodCategory');

  insert into public.foods (name, brand, source, source_id, gtin, kcal_per_100g, servings, usda_category, store_section)
  values (f->>'description',
          coalesce(nullif(f->>'brandName',''), nullif(f->>'brandOwner','')),
          'usda', p_fdc_id::text, nullif(f->>'gtinUpc',''), round(kcal, 1), servings, cat, public.store_section_for(cat))
  returning id into new_id;
  return new_id;
end $$;

revoke all on function public.usda_get(text) from public, anon, authenticated;
revoke all on function public.usda_search(text, int) from public, anon, authenticated;
revoke all on function public.usda_lookup_gtin(text) from public, anon, authenticated;
revoke all on function public.usda_save(bigint) from public, anon, authenticated;
