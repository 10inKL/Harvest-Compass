-- Store confirmed field geometry separately from the suggested public boundary layer.
alter table public.fields add column if not exists boundary_geojson jsonb;
alter table public.fields add column if not exists boundary_source text;
alter table public.fields add column if not exists boundary_confirmed boolean not null default false;
alter table public.fields add constraint fields_boundary_geojson_object check (boundary_geojson is null or jsonb_typeof(boundary_geojson) = 'object');
