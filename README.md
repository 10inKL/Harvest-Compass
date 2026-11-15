# HarvestCompass

**Plan Smarter. Harvest Better.** A hackathon MVP for Midwest farm operations, from field planning to harvest preparation and season reporting.

## What works now

- Responsive dashboard with acreage, field status, tasks, expenses, crop progress, and recent activity.
- Pages for Farm Map, Farm Operations, Action Plan, AI Assistant, and Reports & History.
- Add, edit, and delete fields, tasks, expenses, and equipment. Complete or reopen tasks and update equipment status. Hosted changes are confirmed by Supabase before the UI updates.
- Dashboard totals and expense chart update from edited records.
- With Supabase configured, records persist in the hosted database for signed-in users. Without it, records persist in the current browser through local storage. The initial South Dakota farm records are **fictional demo data**.

The AI assistant page previews the intended workflow. No AI model, live weather feed, or live maps are connected yet. Supabase-backed records are scoped to signed-in farm members. Farmers will approve important AI-suggested plan changes in a later phase.

## Run locally

Requires Node.js and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The root route redirects to `/dashboard`.

```bash
npm run lint
npm run build
```

## Project structure

- `app/`: Next.js App Router pages and global styles.
- `components/`: shared shell, chart, farm data provider, and record forms.
- `lib/`: TypeScript farm types and demo seed data.
- `supabase/migrations/`: hosted schema and row-level security policies.
- `PHASE2.md`: current persistence status and remaining connection work.

## Planned hosted setup

To use hosted storage, apply `supabase/migrations/202611140001_initial.sql` to a Supabase project. Copy `.env.example` to `.env.local` and add the project URL and **publishable** key. Restart the development server, then sign in with an email link. Do not put secret or service-role keys in client environment variables or commit `.env.local`.

## AI Assistant

Apply `supabase/migrations/202611150002_assistant.sql` after the initial and harvest migrations. It adds private chat history, reviewable task proposals, an atomic approval function, and optional farm coordinates. The assistant uses the signed-in user's Supabase token and existing row-level security; it does not use a service-role key.

Add `OPENAI_API_KEY` manually to `.env.local` and restart the server. `OPENAI_MODEL` is optional and defaults to `gpt-5-mini`. In production, configure both as server-side hosting environment variables. Supabase sign-in is required for AI use so chats remain private and persistent. Settings → AI Configuration reports only whether a key exists. This project deliberately does not offer browser-based key saving, because it has no encrypted secret store. The Test connection button makes a live OpenAI call only when clicked.

The assistant uses the official OpenAI Node SDK Responses API with streaming and automatic function calling. Farm facts come from saved Supabase records. NOAA forecasts use saved farm coordinates when available; if a farmer asks about a city/place or the farm has only location text, the server resolves that text through the free OpenStreetMap Nominatim geocoder and labels the NOAA result as approximate. NOAA failures and unresolved places produce an explicit unavailable result. Supplies, labor bookings, approved budgets, and historical yields beyond logged harvests are not in the current schema and are reported as missing. Production and equipment comparisons require stated assumptions. Proposed changes remain pending until the farmer approves them, at which point the app adds a task to the Action Plan. Conversations and proposals are private to the signed-in farmer.

After you configure the key and explicitly choose to test live AI, try these prompts in `/ai-assistant`:

1. `Explain crop rotation in plain language.` The assistant should answer naturally without needing farm tools.
2. `What supplies and labor bookings do I have?` It should say those categories are not stored yet.
3. `Summarize my fields, expenses, and logged harvest.` It should use saved records, flag demo-seeded entries, and show record sources.
4. `My combine is delayed 48 hours. Compare the schedule for 320 acres at 20 acres per hour, assuming $125 per hour of delay cost, and propose a task to check repair options.` It should show the assumptions, avoid inventing quotes, and present a pending approval card. Only clicking **Approve and add task** changes the Action Plan.

`node --test tests/assistant-*.test.mjs` checks production and delay arithmetic, demo provenance, missing-data behavior, and proposal safety without contacting OpenAI or NOAA.

## Harvest and inventory

Record harvested bushels by field, date, moisture, and storage bin at `/harvest`. `/inventory` groups those entries by crop and bin. Inventory is calculated from harvest records and does not yet subtract sales, transfers, or shrink. Apply `supabase/migrations/202611150001_harvest_entries.sql` after the initial migration to enable hosted harvest logging.
