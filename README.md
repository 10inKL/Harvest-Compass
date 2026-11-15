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
