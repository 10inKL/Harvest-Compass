# Phase 2 status

The app supports editable fields, tasks, expenses, and equipment. Dashboard acreage, field count, open tasks, estimated expenses, and the expense chart derive from these records.

With `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` configured in `.env.local`, the app uses Supabase email sign-in and stores records in the hosted database. Each new account gets a clearly labeled fictional Prairie Creek Farm demo dataset. The SQL schema and row-level security policies live in `supabase/migrations/202611140001_initial.sql`.

Without those environment variables, the app runs in demo mode and saves records in browser local storage. Never commit `.env.local` or use a service-role key in the browser.

The AI assistant and real decision approvals are still future work. Farm location and season are demo constants for this MVP.
