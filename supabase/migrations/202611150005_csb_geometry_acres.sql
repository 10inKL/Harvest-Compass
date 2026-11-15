-- Expose acreage calculated from the full imported geometry. Preserve the USDA
-- acreage estimate separately as usdaAcres for provenance and comparison.
alter table public.csb_boundaries alter column acres type double precision;
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
        'csbid', b.csbid,
        'acres', round((extensions.st_area(b.geom::extensions.geography) / 4046.8564224)::numeric, 2),
        'usdaAcres', b.acres,
        'source', b.source_release,
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
