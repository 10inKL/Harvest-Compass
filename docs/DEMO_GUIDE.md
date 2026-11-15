# Demo walkthrough

Use a dedicated demonstration account and identify invented entries. Keep keys, `.env.local`, database connection strings and provider account pages off the presentation screen.

## Before presenting

1. Pull the intended commit. Run `npm ci`, `npm test`, `npm run lint` and `npm run build`.
2. Confirm the Supabase schema and pilot boundaries are available. A fresh clone does not include USDA archives or local indexes.
3. Configure required integrations and restart the server. Missing keys intentionally leave those features unavailable.
4. Test sign-in and confirmation ahead of time; email rate limits can interrupt repeated signup during a demo.
5. Check map selection near Brookings/Madison, forecasts, the USDA report date, microphone permission and a PDF download. Unit tests do not verify provider uptime or browser permissions.

## Suggested presentation

1. **Welcome:** open the public read-only demo. Explain that private accounts start with their own records.
2. **Farm:** sign in and show the demo account’s farm name, location, season and workspace selector.
3. **Map:** search Madison, SD; choose an available USDA estimate, name the field, choose its current crop and confirm. Explain the boundary is not a legal parcel.
4. **Operations:** enter planting status and an equipment agreement. Explain rental planning estimates versus recorded expenses.
5. **Tasks:** add a normal task such as testing grain moisture or servicing a combine, with an appropriate date and priority.
6. **Overview:** show record totals, forecast and regional cash bids. Point out the report date and that bids are not guaranteed elevator offers.
7. **Assistant:** ask “Review my saved fields, equipment and upcoming tasks. Give me three priorities.” Then try “Compare harvesting 200 acres at 20 acres per hour with a 48-hour delay and $100 per hour of downtime.” Identify these as supplied scenario assumptions.
8. **Approval:** request a task proposal. Review and approve/dismiss it; verify an approved task appears in Action Plan. Generating advice alone must not change records.
9. **Voice:** hold the mic, speak, release, edit the text and press Send. It is not live spoken conversation.
10. **Harvest and sale:** enter an explicitly fictional harvest and sale; show recorded inventory and revenue updating.
11. **Report:** download the farm PDF. A fresh AI assessment depends on OpenAI availability; recorded figures can export without it.

## Explain the AI accurately

“We use a hosted OpenAI model with structured farm-data retrieval and tool calling. TypeScript functions handle calculations. Supabase stores records and chat history, and task changes require farmer approval. We did not train a foundation model or build a custom RLHF pipeline.”

The default chat model is `gpt-5-mini`, configurable on the server. Groq’s `whisper-large-v3-turbo` transcribes speech; it does not produce farm advice. The assistant has no live business-directory search or market-price tool. Dashboard grain prices are a separate integration.

If a service fails, show its real unavailable state and continue with saved records. Do not substitute fictional “live” results. See the [README](../README.md) for setup and limitations.
