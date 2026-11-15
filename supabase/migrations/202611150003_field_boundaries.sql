-- Store confirmed field geometry separately from the suggested public boundary layer.
alter table public.fields add column if not exists boundary_geojson jsonb;
alter table public.fields add column if not exists boundary_source text;
alter table public.fields add column if not exists boundary_confirmed boolean not null default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fields_boundary_geojson_object') then
    alter table public.fields add constraint fields_boundary_geojson_object check (boundary_geojson is null or jsonb_typeof(boundary_geojson) = 'object');
  end if;
end $$;
