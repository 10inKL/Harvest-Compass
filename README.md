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
GROQ_API_KEY=your-groq-free-plan-key
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
GEOAPIFY_API_KEY=your-free-tier-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The app works in clearly labeled demo mode when Supabase is not configured. Never commit `.env.local` or expose the OpenAI key with a `NEXT_PUBLIC_` prefix.

## Working MVP

- `/` — public HarvestCompass welcome page with signup, sign-in, and a clearly separated Prairie Creek product demo.
- `/signup`, `/login`, `/forgot-password`, and `/reset-password` — Supabase email/password authentication with confirmation and recovery flows. Passwords are handled only by Supabase Auth.
- `/onboarding` — first-time users name their blank farm workspace before continuing to field setup. New accounts never inherit Prairie Creek demo records.
- `/demo` — public, read-only preview using explicitly fictional Prairie Creek records.
- `/dashboard` — live seasonal overview calculated from the selected farm's saved fields, tasks, expenses, equipment, harvest entries, and grain sales.
- Overview weather uses the free NOAA/NWS API for a seven-day forecast and a recent nearby-station observation when available. It starts from saved weather coordinates or a confirmed field boundary. Farmers can switch fields or save a town-level forecast location using the existing Geoapify search. No additional weather key or database migration is needed. Missing precipitation and temperatures remain unknown rather than becoming zero; times use the forecast location's timezone. Forecast data is cached for ten minutes and the panel checks again every fifteen minutes while the tab is visible.
- Farm Settings → Assistant & weather settings uses the same location picker as the overview. Search a town/address/ZIP or select a confirmed mapped field, then save through the existing authenticated location endpoint. Manual coordinates are not required. Technical key setup and the explicitly triggered live OpenAI check are inside a collapsed advanced section. Configuration loading handles failed requests and resets when switching farm workspaces.
- `/farm-map` — satellite/street map with selectable suggested boundaries. Confirmed boundaries are stored as GeoJSON and labeled with their source.
- `/ai-assistant` — streaming OpenAI copilot with farm context, deterministic tools, saved conversations, and approval-gated proposals.
- `/operations` and `/action-plan` — edit equipment, fields, and tasks; records update the dashboard and assistant context.
- `/harvest` and `/inventory` — record harvest by field and storage bin, record sales, and see remaining inventory and revenue.
- `/reports` — expense and crop summaries from saved records, with a downloadable CSV.
- `/settings/farm` — edit the farm profile, create a blank farm, and switch workspaces. New accounts start empty; older fictional demo workspaces remain clearly labeled.
- `/settings/ai` — server-side API configuration status and test connection controls.

Run `npm run lint` and `npm run build` before a demo. Hosted databases need migrations through `supabase/migrations/202611150006_grain_sales.sql`; the current hosted project has the grain-sales migration applied.

### Grain selling prices

The overview shows USDA AMS **South Dakota Daily Grain Bids (report 3186)** beside the weather on wide screens and below it on smaller screens. Corn and soybean prices are regional current-delivery cash bids in USD per bushel, not futures, individual buyer quotes, actual sales or guaranteed proceeds. Choose a South Dakota region explicitly; the card does not infer an elevator or farm market from its coordinates. Every result shows its report date and retrieval time; older reports are labeled and missing prices remain unavailable.

Create a free account at https://mymarketnews.ams.usda.gov/ and find your key in your profile. Add `USDA_MARKET_NEWS_API_KEY=your_key_here` manually to the project’s ignored `.env.local`, then restart `npm run dev`. Never share or commit the key. Production uses the same server-side environment variable. No payment or database migration is required. Without a key, farmers see a connection-pending message and a link to the official report.

The authenticated `/api/market-prices` server route fetches public publication metadata first, then requests only that report date using USDA Basic authentication. Credentials never reach the browser. Normalized prices are cached in memory for one hour, concurrent requests are coalesced, and errors have a one-minute backoff. Units, price ranges, dates, current delivery and ambiguous price series are validated; unsupported results are not displayed. The cache is per server instance. No raw provider errors or credentials are logged or returned.

Checks: `node --experimental-strip-types --test tests/grain-market.test.mjs`. Tests mock provider responses and cover the verified USDA grain schema: `trade_loc`, spaced price keys, `$ Per Bushel` units and the `current` flag. An authenticated live report was verified during user-authorized troubleshooting; subsequent automated tests never use real credentials. USDA docs: https://mymarketnews.ams.usda.gov/mymarketnews-api/authentication and https://mymarketnews.ams.usda.gov/mymarketnews-api/filtering.

### Voice questions

The assistant microphone uses Groq's speech-to-text API, then inserts editable text into the existing OpenAI chat composer. Set `GROQ_API_KEY` in `.env.local` and restart the development server. Keep the Groq account on its Free plan; account-wide quotas still apply. No new package, paid subscription, or database migration is required. Neither the OpenAI credential nor farm records/chat history are sent to Groq.

Hold the microphone button to speak, then release to transcribe directly into your message. Keyboard users can hold Space or Enter while the microphone is focused. Allow browser access on first use, then hold again if the permission prompt interrupted the gesture. Record up to 60 seconds. Edit the inserted text if needed, then click **Send**. Transcription arrives after release; this is not live word-by-word dictation. If a transcript exceeds the remaining message space, shorten it before inserting. Cancel discards the recording or transcript; it never submits a chat. Audio stays in memory and is not saved by HarvestCompass. Chrome, Edge, and Safari use supported recording formats where available; microphone access requires HTTPS or localhost. Plain HTTP on another device's LAN address does not enable microphone recording.

Typed chat continues to work when voice is unavailable. Permission failures, unsupported audio, silence, timeouts, and quota errors have explicit messages. The server caps audio at 4 MiB and adds per-process request/concurrency throttling; this is not an account-wide or multi-instance quota guarantee. For a scaled deployment, move rate accounting into shared infrastructure. No paid transcription fallback is used.

Voice checks: `node --experimental-strip-types --test tests/voice-transcription.test.mjs`. These tests mock provider requests and never use real credentials. Live microphone/provider testing is a separate user-triggered step.

### Authentication and location services

Supabase Auth is the only authentication provider. It already supplies secure password storage, email confirmation, password recovery, persisted browser sessions, and user identity for the existing row-level security policies, so this phase does not require another auth API or a new profile table. The farmer's display name and onboarding state are stored in Supabase Auth metadata; farms and memberships remain in the existing `farms` and `farm_members` tables.

Geoapify remains the location-autocomplete provider because the application already uses it and its Free plan currently includes 3,000 credits per day. The US Census Geocoder is a useful free fallback for submitted US street addresses and coordinate lookups, but it is not a type-ahead place autocomplete service. The public OpenStreetMap Nominatim endpoint is intentionally not used for autocomplete because its usage policy prohibits that use.

For Supabase email confirmation and recovery links, add your local and deployed app origins to **Authentication → URL Configuration** in the Supabase dashboard. At minimum, local development should allow `http://localhost:3000/**`.

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
