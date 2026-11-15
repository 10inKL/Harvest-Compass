🌽 Harvest Compass

An AI assisted farm planning and logistic tool.
One farm record, from the first seed order to the last bushel sold.

Harvest Compass helps a farmer secure what they need before the season, coordinate harvest with the equipment and grain-handling capacity they actually have, and understand what is left after the grain is sold.

Built for Wildfire Labs Ignite Hackathon, November 15 by 10inKL: Bhupendra Bohara, Krish Kushwaha, Anurag Thapa Magar, Nimesh Shrestha.

## Run locally

```bash
npm install
npm run dev
```

Create `.env.local` in the project root for live integrations. Keep secrets server-side:

```env
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-5-mini
GEOAPIFY_API_KEY=your-free-tier-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The app works in clearly labeled demo mode when Supabase is not configured. Never commit `.env.local` or expose the OpenAI key with a `NEXT_PUBLIC_` prefix.

## Current vertical slices

- `/dashboard` — seasonal overview with expenses, tasks, fields, and AI insight preview.
- `/farm-map` — satellite/street map with selectable suggested boundaries. Confirmed boundaries are stored as GeoJSON and labeled with their source.
- `/ai-assistant` — streaming OpenAI copilot with farm context, deterministic tools, saved conversations, and approval-gated proposals.
- `/harvest` and `/inventory` — persistent harvest and grain inventory records when the Supabase harvest migration is enabled.
- `/settings/ai` — server-side API configuration status and test connection controls.

Run `npm run lint` and `npm run build` before a demo. If the hosted database predates the map feature, run `supabase/migrations/202611150003_field_boundaries.sql` once in the Supabase SQL Editor.

### USDA field-boundary pilot

The official USDA NASS 2018–2025 archive is intentionally not committed to GitHub. The original extraction produces the South Dakota source; the hosted pilot uses the nine counties listed below.

```bash
python3 -m venv /tmp/harvestcompass-csb-env
/tmp/harvestcompass-csb-env/bin/pip install geopandas pyogrio
/tmp/harvestcompass-csb-env/bin/python scripts/extract_csb_county.py \
  data/csb/NationalCSB_2018-2025_rev23.zip \
  data/csb/south-dakota-csb.geojson --state-fips 46
```

The extractor accepts `--state-fips 46` for all South Dakota, or `--county-fips 011` for Brookings alone. The full South Dakota extract contains 725,473 polygons and is about 1.2 GB as GeoJSON; it has **not** been imported into Supabase. USDA CSB polygons are estimated agricultural fields, not legal, ownership, or FSA boundaries. The map labels them as estimates and requires the farmer to confirm the current crop.

Location autocomplete uses Geoapify's free tier with `GEOAPIFY_API_KEY` kept on the server. It accepts US cities, addresses and ZIP codes; coordinates work without a key. Saved field names are suggested from the current farm. No location searches are restricted to South Dakota, but estimated boundaries are shown only where USDA data has actually been imported. The public Nominatim endpoint is not used for autocomplete because its usage policy forbids it.

For a direct Postgres import, install `psycopg[binary]`, set a server-side `SUPABASE_DB_URL` temporarily, and run `scripts/import_csb_supabase.py`. Do not commit that connection string.

For the local hackathon demo, build a spatially indexed SQLite file from the South Dakota extract:

```bash
/tmp/harvestcompass-csb-env/bin/pip install ijson
/tmp/harvestcompass-csb-env/bin/python scripts/build_csb_index.py \
  data/csb/south-dakota-csb.geojson data/csb/south-dakota-csb.sqlite
```

The original 420 MB statewide SQLite index remains local and excluded from Git. The map API queries hosted PostGIS first, falls back to the local index if needed, and splits crowded visible areas into smaller bounding boxes. If a view is still capped, the map asks the farmer to zoom in. The USDA source archive, extracted GeoJSON and local indexes are not shipped with the repository.

For the hosted Free-tier pilot, extract the nine selected counties without sampling:

```bash
/tmp/harvestcompass-csb-env/bin/python scripts/prepare_csb_counties.py \
  data/csb/south-dakota-csb.geojson data/csb/south-dakota-selected-counties.geojson
/tmp/harvestcompass-csb-env/bin/python scripts/build_csb_index.py \
  data/csb/south-dakota-selected-counties.geojson data/csb/south-dakota-selected-counties.sqlite
```

The nine counties are Brookings, Lake, Moody, Minnehaha, Lincoln, McCook, Miner, Deuel, and Kingsbury. The subset contains **79,829 complete USDA polygons** (114.6 MiB GeoJSON, 47 MB selected-county SQLite). All 79,829 were imported into the existing Supabase PostGIS database through the Table Editor using county CSVs; exact SQL counts matched each county. Full precision USDA acreage attributes were verified against all 79,829 source records. The database measured **79 MB total**, including **59 MB** for the boundary table and indexes, leaving about **421 MB** under the Free plan's 500 MB database allowance. Pennington County was not imported.

For a fresh database, apply migrations `202611150003` through `202611150005`, then load the county subset. `scripts/export_csb_csv.py` produces one upload file per county for the Supabase Table Editor (requires `ijson` and `shapely`); alternatively `scripts/import_csb_supabase.py` streams batches over a server-side `SUPABASE_DB_URL`. Never commit that connection string. The hosted project already has the three migrations and all nine counties applied.
