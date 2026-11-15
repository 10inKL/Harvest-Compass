-- USDA NASS Crop Sequence Boundaries pilot storage. Public candidate fields stay
-- separate from farmer-confirmed fields and are explicitly marked as estimates.
create extension if not exists postgis with schema extensions;

create table if not exists public.csb_boundaries (
  id bigint generated always as identity primary key,
  csbid text not null unique,
  source_release text not null default 'USDA NASS CSB 2018-2025',
  state_fips text not null,
  county_fips text not null,
  acres double precision,
  crop_2018 integer, crop_2019 integer, crop_2020 integer, crop_2021 integer,
  crop_2022 integer, crop_2023 integer, crop_2024 integer, crop_2025 integer,
  geom extensions.geometry(MultiPolygon, 4326) not null,
  created_at timestamptz not null default now()
);
create index if not exists csb_boundaries_geom_gist on public.csb_boundaries using gist (geom);
create index if not exists csb_boundaries_county_idx on public.csb_boundaries (state_fips, county_fips);
alter table public.csb_boundaries enable row level security;
drop policy if exists "authenticated read CSB estimates" on public.csb_boundaries;
create policy "authenticated read CSB estimates" on public.csb_boundaries for select to authenticated using (true);
grant select on public.csb_boundaries to authenticated;

create or replace function public.get_csb_boundaries_geojson(min_lng double precision, min_lat double precision, max_lng double precision, max_lat double precision)
returns jsonb
language sql stable security invoker set search_path = public, extensions as $$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(jsonb_build_object(
      'type', 'Feature',
      'id', b.csbid,
      'geometry', extensions.st_asgeojson(b.geom)::jsonb,
      'properties', jsonb_build_object(
        'csbid', b.csbid, 'acres', b.acres, 'source', b.source_release,
        'stateFips', b.state_fips, 'countyFips', b.county_fips,
        'crop2018', b.crop_2018, 'crop2019', b.crop_2019, 'crop2020', b.crop_2020,
        'crop2021', b.crop_2021, 'crop2022', b.crop_2022, 'crop2023', b.crop_2023,
        'crop2024', b.crop_2024, 'crop2025', b.crop_2025
      )
    )), '[]'::jsonb)
  )
  from (
    select * from public.csb_boundaries
    where geom && extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    order by csbid limit 500
  ) b;
$$;
revoke all on function public.get_csb_boundaries_geojson(double precision, double precision, double precision, double precision) from public;
grant execute on function public.get_csb_boundaries_geojson(double precision, double precision, double precision, double precision) to authenticated;
