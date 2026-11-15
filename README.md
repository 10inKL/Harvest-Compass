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

The USDA NASS 2018–2025 archive is intentionally not committed to GitHub. It is downloaded locally and filtered to Brookings County before import:

```bash
python3 -m venv /tmp/harvestcompass-csb-env
/tmp/harvestcompass-csb-env/bin/pip install geopandas pyogrio
/tmp/harvestcompass-csb-env/bin/python scripts/extract_csb_county.py \
  data/csb/NationalCSB_2018-2025_rev23.zip \
  data/csb/brookings-csb.geojson
```

Run `supabase/migrations/202611150004_csb_boundaries.sql`, then bulk-load the extracted GeoJSON. The extractor accepts `--state-fips 46` for all South Dakota, or add `--county-fips 011` for the smaller Brookings pilot. The full South Dakota extract contains 725,473 polygons and is about 1.2 GB as GeoJSON, so check the hosted database storage allowance before importing it. The app endpoint `/api/map/fields` returns a bounded visible-area subset as GeoJSON. USDA CSB polygons are estimates of crop fields—not legal, ownership, or FSA boundaries—and the UI labels them accordingly.

Location autocomplete uses Geoapify's free tier with `GEOAPIFY_API_KEY` kept on the server. It accepts US cities, addresses and ZIP codes; coordinates work without a key. Saved field names are suggested from the current farm. No location searches are restricted to South Dakota, but estimated boundaries are shown only where USDA data has actually been imported. The public Nominatim endpoint is not used for autocomplete because its usage policy forbids it.

For a direct Postgres import, install `psycopg[binary]`, set a server-side `SUPABASE_DB_URL` temporarily, and run `scripts/import_csb_supabase.py`. Do not commit that connection string.

For the local hackathon demo, build a spatially indexed SQLite file from the South Dakota extract:

```bash
/tmp/harvestcompass-csb-env/bin/pip install ijson
/tmp/harvestcompass-csb-env/bin/python scripts/build_csb_index.py \
  data/csb/south-dakota-csb.geojson data/csb/south-dakota-csb.sqlite
```

The Next.js map API uses this local index when present, returning at most 500 features per visible map request. The indexed file is about 420 MB and is excluded from Git. On a hosted deployment without this file, apply the PostGIS migration and import the state data in batches within the database's storage allowance. The USDA source archive, extracted GeoJSON and local index are not shipped with the repository.
