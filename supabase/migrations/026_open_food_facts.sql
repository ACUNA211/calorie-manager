-- Calorie Manager: Open Food Facts fallback for Scan (ticket #19, ADR 0002, ADR 0003)
-- When USDA has no match for a barcode, the off-lookup Edge Function asks Open Food Facts
-- (ODbL). Its products are stored unmodified in their own table, never in the Food Library
-- (public.foods). Signed-in Members may read them; only the Edge Function (service role)
-- writes them.

-- One row per barcode, keyed by the GTIN form with leading zeros removed (the key
-- usda_lookup_gtin uses), holding the product exactly as Open Food Facts returned it.
create table public.off_products (
  barcode text primary key check (barcode ~ '^[1-9][0-9]{0,13}$'),
  off_code text not null,
  product jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.off_products enable row level security;
revoke all on public.off_products from anon;
revoke insert, update, delete on public.off_products from authenticated;
create policy off_products_select on public.off_products
  for select to authenticated using (true);

-- The times of recent Open Food Facts product reads, so the Edge Function can keep under
-- 15 reads a minute (the limit in https://openfoodfacts.github.io/openfoodfacts-server/api/).
-- Not readable by anyone but the service role.
create table public.off_read_log (
  id bigint generated always as identity primary key,
  read_at timestamptz not null default now()
);
create index off_read_log_read_at_idx on public.off_read_log (read_at);

alter table public.off_read_log enable row level security;
revoke all on public.off_read_log from anon, authenticated;
