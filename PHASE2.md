# Phase 2 progress

Fields, tasks, expenses, and equipment are editable in the app and persist in browser local storage. Dashboard acreage, field count, open tasks, estimated expenses, and the expense chart recalculate from those records. This is a single-browser interim store, not shared farm data.

The Supabase schema and row-level security policies are in `supabase/migrations/202611140001_initial.sql`. To connect hosted persistence and authentication, create a Supabase project, apply that migration, and provide the project URL and **publishable** key. Never provide a service-role key. Hosted data syncing and sign-in are not active yet.
