# HarvestCompass

**Plan Smarter. Harvest Better.** A hackathon MVP for Midwest farm operations, from field planning to harvest preparation and season reporting.

## What works now

- Responsive dashboard with acreage, field status, tasks, expenses, crop progress, and recent activity.
- Pages for Farm Map, Farm Operations, Action Plan, AI Assistant, and Reports & History.
- Add and delete fields, tasks, expenses, and equipment. Complete or reopen tasks and update equipment status.
- Dashboard totals and expense chart update from edited records.
- Records persist in the current browser through local storage. The initial South Dakota farm records are **fictional demo data**.

The AI assistant page previews the intended workflow. No AI model, live weather feed, maps, or hosted database is connected yet. Changes are not shared across browsers or users. Farmers will approve important AI-suggested plan changes in a later phase.

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
- `supabase/migrations/`: proposed hosted schema and row-level security policies, not yet applied.
- `PHASE2.md`: current persistence status and remaining connection work.

## Planned hosted setup

A Supabase project can replace browser storage using the schema in `supabase/migrations/202611140001_initial.sql`. Copy `.env.example` to `.env.local` and add the project URL and **publishable** key when hosted integration is implemented. Do not put secret or service-role keys in client environment variables or commit `.env.local`.
