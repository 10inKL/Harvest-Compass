-- Harvest entries drive the inventory summary. No separate inventory balance is stored.
alter table public.fields add constraint fields_farm_id_id_unique unique (farm_id, id);
create table public.harvest_entries (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  field_id uuid not null,
  harvested_on date not null,
  bushels numeric(12,2) not null check (bushels > 0),
  moisture_percent numeric(5,2) check (moisture_percent is null or moisture_percent between 0 and 100),
  storage_bin text not null default 'Unassigned' check (length(trim(storage_bin)) > 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  constraint harvest_entries_field_fk foreign key (farm_id, field_id) references public.fields(farm_id, id) on delete restrict
);
create index harvest_entries_farm_date_idx on public.harvest_entries(farm_id, harvested_on desc);
create index harvest_entries_field_idx on public.harvest_entries(field_id);
alter table public.harvest_entries enable row level security;
create policy "members manage harvest entries" on public.harvest_entries for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
grant select, insert, update, delete on public.harvest_entries to authenticated;
