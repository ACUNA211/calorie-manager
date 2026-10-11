-- Calorie Manager: core schema (tickets #12, #13, #14, #18, #20)
-- Vocabulary follows CONTEXT.md. RLS is on with no policies: only the
-- Supabase connector (service role) and the Agent read or write these tables.

-- Member settings: one row
create table public.member_settings (
  id smallint primary key default 1 check (id = 1),
  calorie_target integer check (calorie_target > 0),
  band_low_pct integer not null default 90 check (band_low_pct between 50 and 100),
  band_high_pct integer not null default 100 check (band_high_pct between 50 and 100),
  updated_at timestamptz not null default now(),
  check (band_low_pct <= band_high_pct)
);
insert into public.member_settings (id) values (1);

-- Meal Times
create table public.meal_times (
  id bigint generated always as identity primary key,
  name text not null,
  time_of_day time not null,
  weekdays smallint[] not null default '{0,1,2,3,4,5,6}', -- 0 = Sunday
  kind text not null check (kind in ('set','planned','if_room')),
  cal_min integer,          -- planned / if_room
  cal_max integer,          -- planned / if_room
  set_calories integer,     -- set
  created_at timestamptz not null default now(),
  check (kind <> 'set' or set_calories is not null),
  check (cal_min is null or cal_max is null or cal_min <= cal_max)
);

-- Food Library
create table public.foods (
  id bigint generated always as identity primary key,
  name text not null,
  brand text,
  source text not null check (source in ('usda','label','estimated')),
  source_id text,           -- USDA fdcId
  gtin text,
  kcal_per_100g numeric not null check (kcal_per_100g >= 0),
  servings jsonb not null default '[]', -- [{"label":"1 can","grams":425}]
  usda_category text,
  store_section text not null default 'Other',
  created_at timestamptz not null default now()
);
create unique index foods_source_id_key on public.foods (source, source_id) where source_id is not null;
create index foods_gtin_idx on public.foods (gtin) where gtin is not null;

-- Recipes
create table public.recipes (
  id bigint generated always as identity primary key,
  name text not null,
  starred boolean not null default false,
  servings numeric not null default 1 check (servings > 0),      -- "makes N servings"
  cooked_weight_g numeric check (cooked_weight_g > 0),           -- weighed yield, if known
  meal_time_tags bigint[] not null default '{}',                 -- a hint, not a rule
  copied_from bigint references public.recipes(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  id bigint generated always as identity primary key,
  recipe_id bigint not null references public.recipes(id) on delete cascade,
  food_id bigint not null references public.foods(id),
  grams numeric not null check (grams > 0),
  amount_text text,         -- as entered, e.g. "2 lb"
  sort integer not null default 0
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);

create view public.recipe_totals with (security_invoker = true) as
select r.id as recipe_id,
       coalesce(sum(ri.grams * f.kcal_per_100g / 100), 0) as kcal_total,
       coalesce(sum(ri.grams * f.kcal_per_100g / 100), 0) / r.servings as kcal_per_serving,
       r.cooked_weight_g / r.servings as grams_per_serving
from public.recipes r
left join public.recipe_ingredients ri on ri.recipe_id = r.id
left join public.foods f on f.id = ri.food_id
group by r.id;

-- Meal Plans, Cooks, Portions
create table public.meal_plans (
  id bigint generated always as identity primary key,
  week_start date not null unique check (extract(dow from week_start) = 0), -- Sunday
  status text not null default 'draft' check (status in ('draft','approved')),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.cooks (
  id bigint generated always as identity primary key,
  meal_plan_id bigint not null references public.meal_plans(id) on delete cascade,
  recipe_id bigint not null references public.recipes(id),
  cook_date date not null,
  servings_made numeric not null check (servings_made > 0),
  created_at timestamptz not null default now()
);
create index cooks_plan_idx on public.cooks (meal_plan_id);

create table public.portions (
  id bigint generated always as identity primary key,
  cook_id bigint not null references public.cooks(id) on delete cascade,
  meal_time_id bigint not null references public.meal_times(id) on delete cascade,
  eat_date date not null,
  servings numeric not null check (servings > 0),
  unique (meal_time_id, eat_date)
);
create index portions_cook_idx on public.portions (cook_id);

-- Calorie Log
create table public.calorie_log (
  id bigint generated always as identity primary key,
  log_date date not null,
  meal_time_id bigint references public.meal_times(id) on delete set null,
  log_time time,                    -- for "another time"
  portion_id bigint references public.portions(id) on delete set null,
  recipe_id bigint references public.recipes(id) on delete set null,
  food_id bigint references public.foods(id) on delete set null,
  description text not null,
  servings numeric,
  grams numeric,
  kcal numeric not null check (kcal >= 0),
  is_estimate boolean not null default false,
  created_at timestamptz not null default now()
);
create index calorie_log_date_idx on public.calorie_log (log_date);

-- Shopping list: extend the existing grocery_list
alter table public.grocery_list
  add column food_id bigint references public.foods(id) on delete set null,
  add column meal_plan_id bigint references public.meal_plans(id) on delete set null,
  add column source text not null default 'hand' check (source in ('hand','plan','plan_extra')),
  add column grams numeric,
  add column store_section text not null default 'Other';

alter table public.member_settings enable row level security;
alter table public.meal_times enable row level security;
alter table public.foods enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.meal_plans enable row level security;
alter table public.cooks enable row level security;
alter table public.portions enable row level security;
alter table public.calorie_log enable row level security;
