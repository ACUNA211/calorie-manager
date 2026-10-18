-- What the live project had before 001: the Grocery List artifact's table (live migration
-- create_grocery_list, 2026-10-09), the http extension and the USDA key in Vault. A fresh
-- database (supabase db reset) needs them; on the live project every statement is a no-op.

create table if not exists public.grocery_list (
  id bigint generated always as identity primary key,
  item_name text not null,
  quantity_needed text,
  purchased boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.grocery_list enable row level security;

create extension if not exists http with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'usda_api_key') then
    perform vault.create_secret('DEMO_KEY', 'usda_api_key', 'USDA FoodData Central API key');
  end if;
end $$;
