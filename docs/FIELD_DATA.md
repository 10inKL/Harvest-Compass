# USDA field-boundary setup

This is optional data preparation, separate from running Next.js. Teammates connecting to the prepared Supabase project do not need to process the archive again.

## Source and coverage

Source: [USDA NASS Crop Sequence Boundaries](https://www.nass.usda.gov/Research_and_Science/Crop-Sequence-Boundaries/), **2018–2025**, local archive `NationalCSB_2018-2025_rev23.zip`. It contains an Esri File Geodatabase (`.gdb`). The extractor reads the `national1825` layer and converts selected records to WGS84 GeoJSON.

The pilot selects all records assigned to nine South Dakota counties by USDA `STATEFIPS` and `CNTYFIPS`. It does not randomly sample fields or clip geometries at county edges. Source county assignment does not guarantee that every polygon is entirely contained within a county or that every real field is represented. Geometry is preserved through selection, with reprojection changing coordinate representation. Retained attributes include CSB ID, USDA acreage, state/county FIPS, crop codes for 2018–2025 and source release; not every nationwide metadata column is retained.

Counts checked against the selected-county **local** SQLite index on November 15, 2026:

| County | County FIPS | Records |
| --- | --- | ---: |
| Brookings | 011 | 11,095 |
| Lake | 079 | 7,679 |
| Moody | 101 | 6,430 |
| Minnehaha | 099 | 11,154 |
| Lincoln | 083 | 7,684 |
| McCook | 087 | 7,523 |
| Miner | 097 | 8,704 |
| Deuel | 039 | 8,014 |
| Kingsbury | 077 | 11,546 |
| **Total** | | **79,829** |

Pennington is an optional extraction flag, not part of the hosted pilot. The original statewide index remains a local fallback. The API prefers a selected-county local index when present; retaining only the statewide index can expose wider local coverage. A hosted empty result does not trigger fallback; a hosted query failure does.

CSB estimates are not legal parcels, ownership records or FSA producer-submitted field boundaries. Farmers confirm the boundary and current crop before saving.

## Processing

Use a separate Python environment. On macOS/Linux:

```bash
python3 -m venv .venv-csb
source .venv-csb/bin/activate
python -m pip install geopandas pyogrio ijson shapely python-dotenv 'psycopg[binary]'
```

On Windows PowerShell, create it with `py -m venv .venv-csb` and use `.\.venv-csb\Scripts\python.exe` instead of `python` below. Activation is optional. This virtual environment is ignored by Git.

Download the official archive separately under `data/csb/`. The checked local archive is about 3.5 GiB; extraction requires additional disk space. Processing is not performed on every map request.

```bash
python scripts/extract_csb_county.py data/csb/NationalCSB_2018-2025_rev23.zip data/csb/south-dakota-csb.geojson --state-fips 46
python scripts/prepare_csb_counties.py data/csb/south-dakota-csb.geojson data/csb/south-dakota-selected-counties.geojson
python scripts/build_csb_index.py data/csb/south-dakota-selected-counties.geojson data/csb/south-dakota-selected-counties.sqlite
```

The extractor supports `--county-fips 011` for Brookings only. The county preparation script supports `--include-pennington`; review storage and availability messaging before importing expanded coverage.

To rebuild the original statewide fallback:

```bash
python scripts/build_csb_index.py data/csb/south-dakota-csb.geojson data/csb/south-dakota-csb.sqlite
```

The local SQLite index uses an R-tree and compressed geometry. It stays on the server; the browser does not download the file.

## Import into Supabase

Apply the schema migrations listed in the [README](../README.md) first. Public CSB estimates are stored separately from confirmed farmer fields, with a PostGIS GiST geometry index. Importing candidates does not add fields to a farmer’s workspace.

Choose one import path:

1. **County CSV:** run `python scripts/export_csb_csv.py`. It produces `data/csb/import-csv/*.csv` with EWKT geometry for the Supabase Table Editor. Import into `public.csb_boundaries`. This is an initial-load workflow; do not repeatedly upload identical CSB IDs.
2. **Direct PostgreSQL:** privately set `SUPABASE_DB_URL` in `.env.local` to an authorized database connection string and run `python scripts/import_csb_supabase.py`. Never put that string in source, a command-line argument or a `NEXT_PUBLIC_` variable. The script checks a conservative storage reserve and upserts batches by CSB ID. It does not provision or upgrade a paid plan. Confirm the target database and subset before running it.

Verify hosted counts and size:

```sql
select county_fips, count(*) as fields
from public.csb_boundaries
where state_fips = '46'
group by county_fips
order by county_fips;

select pg_size_pretty(pg_database_size(current_database())) as database_size,
       pg_size_pretty(pg_total_relation_size('public.csb_boundaries')) as boundaries_with_indexes;
```

Earlier team import notes recorded all 79,829 polygons in Supabase and about 79 MB total database usage, including about 59 MB for boundaries and indexes. These are **historical measurements, not current quota readings or guaranteed remaining space**. Check the project storage dashboard before further imports.

Checked local sizes: selected-county GeoJSON **114.6 MiB**, selected-county SQLite **47.0 MiB**, statewide GeoJSON **1,193.9 MiB**, statewide SQLite **420.0 MiB**. Database size differs because geometry encoding, row storage and indexes differ.

## Serving visible fields

`GET /api/map/fields?minLng=…&minLat=…&maxLng=…&maxLat=…` validates the bounding box and returns GeoJSON. Hosted sessions query the PostGIS `get_csb_boundaries_geojson` function; query failures can fall back to a local index if present.

The backend subdivides crowded boxes, deduplicates results and caps responses at 2,500 features. The interface asks users to zoom in if results remain capped. This limits a response, not the imported dataset. No synthetic boundaries are substituted. Nationwide location search is independent of this coverage.

`data/csb/` is ignored by Git. A fresh clone does not recreate the dataset, copy credentials or restore Supabase records. Back up the database separately and retain the official source or reproducible download instructions.
