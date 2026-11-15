-- Sales are separate from harvest entries so recorded production remains intact.
create table if not exists public.grain_sales (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  crop text not null check (crop in ('Corn', 'Soybeans')),
  storage_bin text not null check (length(trim(storage_bin)) > 0),
  sold_on date not null,
  bushels numeric(12,2) not null check (bushels > 0),
  price_per_bushel numeric(10,2) not null check (price_per_bushel >= 0),
  buyer text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists grain_sales_farm_date_idx on public.grain_sales(farm_id, sold_on desc);
create index if not exists grain_sales_inventory_idx on public.grain_sales(farm_id, crop, storage_bin);
alter table public.grain_sales enable row level security;
drop policy if exists "members manage grain sales" on public.grain_sales;
create policy "members manage grain sales" on public.grain_sales for all to authenticated using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
grant select, insert, update, delete on public.grain_sales to authenticated;
