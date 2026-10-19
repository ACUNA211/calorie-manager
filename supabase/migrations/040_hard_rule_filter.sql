-- Calorie Manager: Hard-rule filter (ticket #38)
-- Code, not the Agent, removes every Recipe that breaks a Hard rule for anyone eating it
-- (CONTEXT.md, Preferences). Hard rules are stored by 037 (member_preferences): foods the
-- Member names, food groups and diet rules from fixed lists.
--
-- HOW A FOOD MAPS TO A GROUP OR DIET RULE
-- The Food Library has a name, a Spanish name (name_es, 017) and the USDA category text
-- (usda_category), nothing else. So every food gets TAGS from keyword rules over those three
-- fields (table private.food_tag_rules). A Hard-rule group or diet rule is a list of tags
-- (table private.hard_rules). A Recipe is forbidden for a Member when one ingredient has a tag
-- that the Member's rule lists, or its name contains a food the Member named.
--   * Name rules are word matches (case and accent insensitive, so "almonds" and "almendras").
--     ignore_pattern first cuts out phrases that look like a match but are not ("peanut
--     butter" is not dairy, "coconut milk" is not dairy).
--   * Category rules (unless_pattern keeps a known exception out) catch foods whose name
--     alone says nothing, such as USDA "Dairy and Egg Products".
--   * Be conservative: when unsure, the food gets the tag and the Recipe is excluded. A food
--     of unknown species ("sausage", "broth", "meat") gets meat_unknown, which every meat
--     group, vegetarian, vegan, pescatarian, halal and kosher forbid. Seafood of unknown kind
--     gets seafood_unknown (fish and shellfish groups, vegetarian, vegan, kosher forbid it).
--   * A food that matches no rule has no tags and is never blocked. The rules are keyword
--     guesses, not an allergen database: a food with an unhelpful name ("Mrs Dash") or a
--     hidden ingredient (soy lecithin, vanilla extract alcohol, wheat in a branded sauce)
--     is NOT caught unless it is named in the Member's own foods list.
--   * Judgement calls: coconut is not a tree nut; oats count as gluten; halal meat is not
--     checked for slaughter, only pork, alcohol, gelatin and unknown meat are blocked;
--     kosher also blocks any Recipe that mixes meat and dairy.
--
-- public.hard_rule_breaks(member_ids) lists each break with its reason (the plan validator,
-- ticket 41, uses it). public.allowed_recipes(member_ids) returns the Recipes with no break
-- for any of the Members. A Member with no Hard rules (or no preferences row) breaks nothing.
-- Both run as the owner (other adults' preferences are not readable by RLS) but only for
-- Members of the caller's own Household, and only that Household's Recipes.
--
-- Run against a LOCAL stack only; the test is supabase/tests/hard_rule_filter_test.sql.

-- 1. Rule tables (private schema: no client access) ------------------------------
create table private.food_tag_rules (
  id integer generated always as identity primary key,
  tag text not null,
  name_pattern text,        -- tested on the food's names, after ignore_pattern is cut out
  ignore_pattern text,      -- removed from the names before name_pattern is tested
  category_pattern text,    -- tested on usda_category
  unless_pattern text,      -- a category match is dropped when the names match this
  check (name_pattern is not null or category_pattern is not null)
);

create table private.hard_rules (
  rule text primary key,    -- a food group or diet rule name from 037
  kind text not null check (kind in ('group','diet')),
  tags text[] not null
);

-- Lower case and drop Spanish accents so one pattern list serves both languages.
create function private.hr_norm(p_text text)
returns text
language sql immutable set search_path = ''
as $$ select translate(lower(coalesce(p_text, '')), 'áéíóúñü', 'aeiounu') $$;

-- 2. Keyword rules ---------------------------------------------------------------
do $seed$
declare
  v_shell text := '\m(shrimps?|prawns?|crabs?|lobsters?|crawfish|crayfish|clams?|mussels?|oysters?|scallops?|squid|calamari|octopus|shellfish|abalone|camarones?|langostas?|almejas?|mejillones|ostras?|pulpo|mariscos?)\M';
  v_fish text := '\m(fish|salmon|tuna|cod|tilapia|trout|sardines?|anchov(y|ies)|mackerel|haddock|halibut|herring|bass|snapper|catfish|pollock|swordfish|mahi|perch|sole|flounder|worcestershire|pescado|atun|bacalao)\M';
begin
  insert into private.food_tag_rules (tag, name_pattern, ignore_pattern, category_pattern, unless_pattern) values
  -- dairy
  ('dairy', '\m(milk|cheeses?|cheesecake|cheddar|mozzarella|parmesan|ricotta|feta|yogh?urt|cream|butter|ghee|whey|casein|kefir|custard|buttermilk|queso|leche|crema|mantequilla|yogur|nata)\M',
     '\m(peanut|almond|coconut|soy|soya|oat|rice|cashew|hazelnut|cocoa|cacao|shea|nut|seed|sunflower|apple|tahini|sesame|pea|hemp|flax) (milk|butter|cream|yogh?urt|cheese)|soymilk|cream of tartar|butter (beans?|lettuce)|butternut|buttercup|butterhead|leche de (coco|almendra|soya|avena|arroz)|mantequilla de (cacahuate|mani|almendra|cacao)',
     null, null),
  ('dairy', null, null, 'dairy', '\m(eggs?|yolks?|huevos?)\M'),
  -- eggs
  ('eggs', '\m(eggs?|yolks?|albumen|mayonnaise|mayo|meringue|huevos?|clara de huevo)\M', 'egg free|eggless', null, null),
  -- fish and shellfish; seafood we cannot tell apart is tagged for both
  ('fish', v_fish || '|fish sauce', null, null, null),
  ('shellfish', v_shell, null, null, null),
  ('seafood_unknown', null, null, 'finfish|shellfish|seafood', v_fish || '|' || v_shell),
  -- peanuts and tree nuts (coconut is not counted; pine nuts are, to be safe)
  ('peanuts', '\m(peanuts?|groundnuts?|cacahuates?|cacahuetes?|mani)\M', null, null, null),
  ('tree_nuts', '\m(almonds?|walnuts?|pecans?|cashews?|pistachios?|hazelnuts?|filberts?|macadamias?|brazil nuts?|pine nuts?|chestnuts?|praline|marzipan|nutella|nut butter|mixed nuts|almendras?|nueces|nuez|avellanas?|pistaches?|castanas?)\M',
     'water chestnuts?', null, null),
  ('tree_nuts', null, null, '\mnuts?\M', '\m(peanuts?|sesame|sunflower|pumpkin|flax|chia|hemp|poppy|seeds?|coconut|tahini)\M'),
  -- wheat and gluten (oats included: usually cross-contaminated)
  ('wheat_gluten', '^(?!.*gluten.free).*\m(wheat|flour|breads?|breadcrumbs?|pasta|spaghetti|macaroni|noodles?|couscous|bulgur|semolina|barley|rye|seitan|tortillas?|pitas?|bagels?|crackers?|cereals?|biscuits?|cookies?|cakes?|pancakes?|waffles?|pizza|dumplings?|ramen|udon|farro|spelt|malt|oats?|oatmeal|granola|soy sauce|beer|croutons?|pretzels?|harina|trigo|fideos|galletas?|cebada|centeno|avena|pan molido)\M',
     '\m(corn|rice|buckwheat|almond|coconut|chickpea|tapioca|potato|cassava) (flour|tortillas?|noodles?|pasta|bread|cereal)|corn tortillas?|rice noodles?|tortillas? de maiz|root beer', null, null),
  ('wheat_gluten', null, null,
     '\m(breads?|buns?|bakery|baked|pasta|noodles?|cereals?|crackers?|biscuits?|cookies?|cakes?|pizza|pastr(y|ies)|tortillas?|wheat|flour)\M|cereal grains',
     'gluten.free|\m(rice|corn|quinoa|cornmeal|millet|sorghum|amaranth|teff|buckwheat|polenta|grits|masa|tapioca)\M'),
  -- soy and sesame
  ('soy', '\m(soy|soya|soybeans?|tofu|tempeh|edamame|miso|natto|soymilk|shoyu|tamari|teriyaki|soja)\M', null, null, null),
  ('sesame', '\m(sesame|tahini|hummus|halva|halvah|ajonjoli|sesamo)\M', null, null, null),
  -- meat
  ('pork', '\m(pork|bacon|ham|prosciutto|pancetta|lard|chorizo|carnitas|chicharrones?|spareribs|tocino|cerdo|jamon|puerco|manteca)\M', null, 'pork', null),
  ('beef', '\m(beef|steaks?|sirloin|brisket|ribeye|veal|hamburgers?|burgers?|oxtail|carne de res|ternera|bistec|carne molida)\M',
     '\m(veggie|vegetarian|vegan|plant|bean|turkey|chicken|black bean) ?burgers?|\m(hamburger|burger|hot dog) (buns?|rolls?)', 'beef', null),
  ('poultry', '\m(chicken|turkey|duck|goose|hen|poultry|quail|cornish|pollo|pavo|pato|gallina)\M', null, 'poultry', null),
  ('other_meat', '\m(lamb|mutton|goat|rabbit|venison|bison|buffalo|boar|liver|kidney|tripe|organ meat|cordero|cabrito|conejo)\M', null, 'lamb|game', null),
  ('meat_unknown', '^(?!.*(substitute|meatless|plant|vegan|vegetarian|imitation|analog|alternative|mushroom|vegetable|veggie|tofu|bean|fruit|coconut meat)).*\m(sausages?|hot ?dogs?|frankfurters?|salami|pepperoni|bologna|mortadella|luncheon|deli meat|lunch meat|cold cuts?|spam|jerky|meatballs?|meat ?loaf|salchichas?|embutidos?|meat|carne|broth|bouillon|stock|pate)\M',
     '(chicken|turkey|beef|pork|lamb)( |-)(sausages?|meatballs?|broth|stock|bouillon|jerky|hot ?dogs?)',
     'sausages and luncheon|luncheon|deli', null),
  -- other
  ('gelatin', '^(?!.*(vegan|vegetarian|agar|pectin)).*\m(gelatin|gelatine|marshmallows?|gummy|gummies|jello|jell-o|gelatina)\M', null, null, null),
  ('alcohol', '^(?!.*(vinegar|non.alcoholic|alcohol.free|root beer|ginger ale|ginger beer|rum extract|vanilla)).*\m(wine|beer|ale|lager|vodka|whisk(e)?y|rum|brandy|liquor|liqueur|bourbon|sake|mirin|sherry|tequila|gin|champagne|cognac|vino|cerveza|alcohol)\M', null, null, null),
  ('honey', '\m(honey|miel)\M', null, null, null);

  -- Hard-rule groups and diet rules from 037 -> tags (what each one forbids)
  insert into private.hard_rules (rule, kind, tags) values
  ('dairy', 'group', '{dairy}'),
  ('eggs', 'group', '{eggs}'),
  ('fish', 'group', '{fish,seafood_unknown}'),
  ('shellfish', 'group', '{shellfish,seafood_unknown}'),
  ('peanuts', 'group', '{peanuts}'),
  ('tree_nuts', 'group', '{tree_nuts}'),
  ('wheat_gluten', 'group', '{wheat_gluten}'),
  ('soy', 'group', '{soy}'),
  ('sesame', 'group', '{sesame}'),
  ('pork', 'group', '{pork,meat_unknown}'),
  ('beef', 'group', '{beef,meat_unknown}'),
  ('poultry', 'group', '{poultry,meat_unknown}'),
  ('vegetarian', 'diet', '{pork,beef,poultry,other_meat,meat_unknown,fish,shellfish,seafood_unknown,gelatin}'),
  ('vegan', 'diet', '{pork,beef,poultry,other_meat,meat_unknown,fish,shellfish,seafood_unknown,gelatin,dairy,eggs,honey}'),
  ('pescatarian', 'diet', '{pork,beef,poultry,other_meat,meat_unknown,gelatin}'),
  ('halal', 'diet', '{pork,meat_unknown,alcohol,gelatin}'),
  ('kosher', 'diet', '{pork,shellfish,seafood_unknown,meat_unknown,gelatin}'),
  ('gluten_free', 'diet', '{wheat_gluten}'),
  ('dairy_free', 'diet', '{dairy}');
end
$seed$;

-- 3. Tags of one food ------------------------------------------------------------
create function private.food_tags(p_name text, p_name_es text, p_category text)
returns text[]
language sql stable set search_path = ''
as $$
  select coalesce(array_agg(distinct r.tag), '{}'::text[])
    from private.food_tag_rules r
   where (r.name_pattern is not null
          and regexp_replace(private.hr_norm(p_name) || ' ' || private.hr_norm(p_name_es),
                             coalesce(r.ignore_pattern, '(?!)'), ' ', 'g') ~ r.name_pattern)
      or (r.category_pattern is not null
          and private.hr_norm(p_category) ~ r.category_pattern
          and not (r.unless_pattern is not null
                   and (private.hr_norm(p_name) || ' ' || private.hr_norm(p_name_es)) ~ r.unless_pattern))
$$;

-- Does a named food ("peanut", "tomatoes") appear as a word in a food's names? Singular or
-- plural either way.
create function private.name_has_food(p_names text, p_term text)
returns boolean
language plpgsql immutable set search_path = ''
as $$
declare
  v_term text := btrim(regexp_replace(private.hr_norm(p_term), '\s+', ' ', 'g'));
  v_alts text[];
  v_alt text;
begin
  if v_term = '' then return false; end if;
  v_alts := array[v_term];
  if v_term like '%es' and length(v_term) > 3 then
    v_alts := v_alts || substr(v_term, 1, length(v_term) - 2);
  end if;
  if v_term like '%s' and length(v_term) > 2 then
    v_alts := v_alts || substr(v_term, 1, length(v_term) - 1);
  end if;
  foreach v_alt in array v_alts loop
    if private.hr_norm(p_names) ~ ('\m' || regexp_replace(v_alt, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '(e?s)?\M') then
      return true;
    end if;
  end loop;
  return false;
end $$;

-- 4. The breaks, with no access checks (the public functions below do those) ------
create function private.hard_rule_breaks_core(p_member_ids bigint[], p_household_id bigint)
returns table (recipe_id bigint, member_id bigint, rule_kind text, rule text, food_id bigint, food_name text)
language sql stable set search_path = ''
as $$
  with ing as (
    select ri.recipe_id, f.id as food_id, f.name,
           private.hr_norm(f.name) || ' ' || private.hr_norm(f.name_es) as names,
           private.food_tags(f.name, f.name_es, f.usda_category) as tags
      from public.recipe_ingredients ri
      join public.recipes r on r.id = ri.recipe_id
      join public.foods f on f.id = ri.food_id
     where r.household_id = p_household_id
  ),
  prefs as (
    select m.id as member_id,
           coalesce(mp.hard_foods, '{}') as hard_foods,
           coalesce(mp.hard_food_groups, '{}') as hard_groups,
           coalesce(mp.hard_diets, '{}') as hard_diets
      from public.members m
      left join public.member_preferences mp on mp.member_id = m.id
     where m.id = any (p_member_ids) and m.household_id = p_household_id
  ),
  found as (
    select i.recipe_id, p.member_id, 'food'::text as rule_kind, t.term as rule, i.food_id, i.name as food_name
      from prefs p
      cross join lateral unnest(p.hard_foods) as t(term)
      join ing i on private.name_has_food(i.names, t.term)
    union
    select i.recipe_id, p.member_id, hr.kind, hr.rule, i.food_id, i.name
      from prefs p
      cross join lateral unnest(p.hard_groups || p.hard_diets) as x(rule)
      join private.hard_rules hr on hr.rule = x.rule
      join ing i on i.tags && hr.tags
    union
    -- kosher: meat and dairy do not share a Recipe
    select i.recipe_id, p.member_id, 'diet'::text, 'kosher'::text, null::bigint, 'meat with dairy'::text
      from prefs p
      join ing i on i.tags && array['pork','beef','poultry','other_meat','meat_unknown']::text[]
     where 'kosher' = any (p.hard_diets)
       and exists (select 1 from ing d where d.recipe_id = i.recipe_id and 'dairy' = any (d.tags))
     group by i.recipe_id, p.member_id
  )
  select recipe_id, member_id, rule_kind, rule, food_id, food_name from found
$$;

-- The caller's Household, after checking every Member is in it. One Household only.
create function private.hard_rule_scope(p_member_ids bigint[])
returns bigint
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_ids bigint[];
  v_households bigint[];
  v_found integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to filter Recipes' using errcode = '28000';
  end if;
  select array_agg(distinct x.id) into v_ids from unnest(p_member_ids) as x(id);
  select array_agg(distinct m.household_id), count(*) into v_households, v_found
    from public.members m
   where m.id = any (v_ids) and m.household_id in (select private.my_household_ids());
  if v_households is null or cardinality(v_households) <> 1 or v_found <> cardinality(v_ids) then
    raise exception 'Members must all belong to your Household' using errcode = '42501';
  end if;
  return v_households[1];
end $$;

-- 5. Public functions ------------------------------------------------------------
-- Every break: which Recipe, which Member, which rule and which ingredient.
create function public.hard_rule_breaks(p_member_ids bigint[])
returns table (recipe_id bigint, member_id bigint, rule_kind text, rule text, food_id bigint, food_name text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_household bigint;
begin
  if auth.uid() is null then
    raise exception 'Sign in to filter Recipes' using errcode = '28000';
  end if;
  if p_member_ids is null or cardinality(p_member_ids) = 0 then return; end if;
  v_household := private.hard_rule_scope(p_member_ids);
  return query select * from private.hard_rule_breaks_core(p_member_ids, v_household);
end $$;

-- The Recipes no one eating may be refused: no ingredient breaks any Member's Hard rule.
-- Members without Hard rules get every Recipe of the Household. A Recipe with no
-- ingredients breaks nothing. With no Members given, the caller's own Household is used and
-- every Recipe comes back.
create function public.allowed_recipes(p_member_ids bigint[])
returns table (recipe_id bigint)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_household bigint;
begin
  if auth.uid() is null then
    raise exception 'Sign in to filter Recipes' using errcode = '28000';
  end if;
  if p_member_ids is null or cardinality(p_member_ids) = 0 then
    select m.household_id into v_household
      from public.members m
     where m.user_id = auth.uid()
     order by m.id limit 1;
    return query select r.id from public.recipes r
      where r.household_id = v_household order by r.id;
    return;
  end if;
  v_household := private.hard_rule_scope(p_member_ids);
  return query
    select r.id
      from public.recipes r
     where r.household_id = v_household
       and not exists (select 1 from private.hard_rule_breaks_core(p_member_ids, v_household) b
                        where b.recipe_id = r.id)
     order by r.id;
end $$;

revoke all on function public.hard_rule_breaks(bigint[]) from public, anon;
revoke all on function public.allowed_recipes(bigint[]) from public, anon;
grant execute on function public.hard_rule_breaks(bigint[]) to authenticated;
grant execute on function public.allowed_recipes(bigint[]) to authenticated;
revoke all on function private.hr_norm(text), private.food_tags(text, text, text),
  private.name_has_food(text, text), private.hard_rule_breaks_core(bigint[], bigint),
  private.hard_rule_scope(bigint[]) from public, anon, authenticated;
