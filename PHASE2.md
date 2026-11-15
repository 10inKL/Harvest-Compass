# Implementation status

Updated November 15, 2026. These notes replace the original Phase 2 snapshot. See [README.md](README.md) for current setup, architecture and limitations.

The MVP now includes Supabase email/password accounts, separate private farm workspaces, saved fields/tasks/equipment/expenses, USDA estimated field selection, NOAA weather, USDA regional cash bids, Groq voice input, streaming OpenAI chat, approval-gated task proposals, harvest and grain sales, and PDF reports. New accounts start empty; the fictional public demo remains separate.

Hosted writes are confirmed by Supabase before records reload. RLS and authenticated routes govern access; dedicated multi-user isolation testing is still needed before production. Apply all seven migrations listed in the README to a fresh database. Migrations do not import USDA polygons; follow [field-data setup](docs/FIELD_DATA.md). Do not blindly rerun initial table creation on an existing project.

Without Supabase, local demo records can persist in browser storage. Private chat and real approvals require hosted accounts. Farm location and season are editable. Keys stay in server configuration; GitHub does not back up keys or database contents.

Still outside the MVP: profile photos, supplies inventory, labor/service bookings, approved budgets, grain transfers/shrink, live business search and a market-price tool inside chat. Production work includes shared rate limits, backups, monitoring and expanded end-to-end/security testing.
