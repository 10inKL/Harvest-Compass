import type { FunctionTool } from "openai/resources/responses/responses";
import type { AssistantSession, FarmContext } from "./server";
import { equipmentScenario, expectedProduction } from "./calculations.ts";

const empty = { type: "object", properties: {}, required: [], additionalProperties: false };
const tool = (name: string, description: string, parameters: Record<string, unknown> = empty): FunctionTool => ({ type: "function", name, description, parameters, strict: true });
const number = { type: "number" };
const string = { type: "string" };
export const assistantTools: FunctionTool[] = [
  tool("get_farm_profile", "Get saved farm name, location, acreage, season and which data categories are unavailable."),
  tool("get_fields", "Get fields, crops, planted dates, acreage and recorded yield by field."),
  tool("get_equipment", "Get saved machinery and availability; no capacity or rental quotes are stored."),
  tool("get_tasks", "Get operational tasks and deadlines."),
  tool("get_budget", "Get recorded expenses. No approved budget or supplier quotes are stored."),
  tool("get_harvest_progress", "Get logged harvest bushels, measured moisture, and inventory by crop/bin. Sales and shrink are not tracked."),
  tool("get_weather_forecast", "Fetch the real NOAA/NWS forecast. Use saved farm coordinates when available; for a city or place question, pass the exact place text. The result identifies whether the location was geocoded and approximate.", { type: "object", properties: { location: { type: ["string", "null"] } }, required: ["location"], additionalProperties: false }),
  tool("calculate_expected_production", "Calculate expected bushels using a stated yield-per-acre assumption. Never invent the assumption.", { type: "object", properties: { field_name: string, yield_bu_per_acre: number }, required: ["field_name", "yield_bu_per_acre"], additionalProperties: false }),
  tool("compare_equipment_scenarios", "Compare a specified combine delay with an explicit harvest rate and downtime cost assumption. Returns deterministic estimates, not quotes.", { type: "object", properties: { acres: number, harvest_rate_acres_per_hour: number, delay_hours: number, downtime_cost_per_hour: number }, required: ["acres", "harvest_rate_acres_per_hour", "delay_hours", "downtime_cost_per_hour"], additionalProperties: false }),
  tool("propose_plan_changes", "Create a pending task proposal for farmer review. Does not change the farm plan.", { type: "object", properties: { title: string, detail: string, due_on: { type: ["string", "null"] }, priority: { type: "string", enum: ["High", "Medium", "Low"] }, risk: string, estimated_cost: { type: ["number", "null"] } }, required: ["title", "detail", "due_on", "priority", "risk", "estimated_cost"], additionalProperties: false }),
];

export type Source = { label: string; url?: string; retrievedAt?: string };
export type Proposal = { id: string; title: string; detail: string; dueOn: string | null; priority: string; risk: string; estimatedCost: number | null; status: string };
export type ToolResult = { output: unknown; source?: Source; proposal?: Proposal };
const finite = (value: unknown, min = 0, max = 1_000_000) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";
const date = (value: unknown) => value === null || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
const farmSource = (ctx: FarmContext, table: string): Source => ({ label: `${table} · ${ctx.source}` });

export async function runTool(name: string, args: unknown, ctx: FarmContext, session: AssistantSession, conversationId: string): Promise<ToolResult> {
  const a = args && typeof args === "object" && !Array.isArray(args) ? args as Record<string, unknown> : {};
  const cropFor = (fieldId: string) => ctx.fields.find(f => f.id === fieldId)?.crop ?? "Unknown crop";
  switch (name) {
    case "get_farm_profile": return { output: { ...ctx.farm, acreage: ctx.fields.reduce((n, f) => n + f.acres, 0), dataSource: ctx.source, unavailable: ["supplies inventory", "labor roster", "service bookings", "approved budget", "historical yields outside recorded harvests"] }, source: farmSource(ctx, "Farm profile") };
    case "get_fields": return { output: ctx.fields.map(f => ({ ...f, recordedBushels: ctx.harvest.filter(h => h.fieldId === f.id).reduce((n, h) => n + h.bushels, 0) })), source: farmSource(ctx, "Fields and harvest entries") };
    case "get_equipment": return { output: { equipment: ctx.equipment, missing: ["machine capacity", "rental availability", "supplier quotes"] }, source: farmSource(ctx, "Equipment") };
    case "get_tasks": return { output: ctx.tasks, source: farmSource(ctx, "Operational tasks") };
    case "get_budget": return { output: { actualOrEnteredExpenses: ctx.expenses, total: ctx.expenses.reduce((n, e) => n + e.amount, 0), approvedBudget: null, note: "Demo-seeded expenses may be season estimates; inspect their notes before calling them actuals." }, source: farmSource(ctx, "Expense records") };
    case "get_harvest_progress": {
      const groups = new Map<string, number>();
      for (const h of ctx.harvest) { const key = `${cropFor(h.fieldId)} · ${h.storageBin}`; groups.set(key, (groups.get(key) ?? 0) + h.bushels); }
      return { output: { entries: ctx.harvest.map(h => ({ ...h, crop: cropFor(h.fieldId), field: ctx.fields.find(f => f.id === h.fieldId)?.name ?? "Unknown" })), totalBushels: ctx.harvest.reduce((n, h) => n + h.bushels, 0), byCropAndBin: Object.fromEntries(groups), note: "Logged bushels only; sales, transfers and shrink are not deducted. Field completion and safe-to-harvest status cannot be inferred from bushels alone." }, source: farmSource(ctx, "Harvest log") };
    }
    case "get_weather_forecast": {
      let { latitude, longitude } = ctx.farm;
      let locationSource = "saved farm coordinates";
      let approximate = false;
      let resolvedLocation = ctx.farm.location;
      if (latitude === null || longitude === null) {
        const place = clean(a.location, 160) || ctx.farm.location;
        if (!place) return { output: { unavailable: "No farm coordinates or place name is available. Ask for a city/state or save a farm location." } };
        try {
          const geocodeUrl = new URL("https://nominatim.openstreetmap.org/search");
          geocodeUrl.searchParams.set("format", "jsonv2");
          geocodeUrl.searchParams.set("limit", "1");
          geocodeUrl.searchParams.set("countrycodes", "us");
          geocodeUrl.searchParams.set("q", place);
          const geocode = await fetch(geocodeUrl, { headers: { "User-Agent": "HarvestCompass/0.1 (https://github.com/10inKL/Harvest-Compass)" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
          if (!geocode.ok) throw new Error("Location lookup failed");
          const matches = await geocode.json() as { lat?: string; lon?: string; display_name?: string }[];
          const match = matches[0];
          if (!match?.lat || !match.lon) return { output: { unavailable: `I could not resolve “${place}” to a US location. Include a city and state, such as Madison, SD.` } };
          latitude = Number(match.lat); longitude = Number(match.lon); resolvedLocation = match.display_name ?? place; locationSource = "geocoded place via OpenStreetMap Nominatim"; approximate = true;
        } catch { return { output: { unavailable: "The location lookup is unavailable right now. No weather estimate was substituted." } }; }
      }
      try {
        const headers = { "User-Agent": "HarvestCompass/0.1 (https://github.com/10inKL/Harvest-Compass)", "Accept": "application/geo+json" };
        const points = await fetch(`https://api.weather.gov/points/${latitude},${longitude}`, { headers, signal: AbortSignal.timeout(8000), cache: "no-store" });
        if (!points.ok) throw new Error("NOAA points request failed");
        const pointData = await points.json() as { properties?: { forecast?: string } };
        const url = pointData.properties?.forecast;
        if (!url || !url.startsWith("https://api.weather.gov/")) throw new Error("NOAA returned no forecast URL");
        const forecast = await fetch(url, { headers, signal: AbortSignal.timeout(8000), cache: "no-store" });
        if (!forecast.ok) throw new Error("NOAA forecast request failed");
        const data = await forecast.json() as { properties?: { updated?: string; periods?: { name: string; startTime: string; temperature: number; temperatureUnit: string; shortForecast: string; detailedForecast: string; probabilityOfPrecipitation?: { value: number | null } }[] } };
        const retrievedAt = new Date().toISOString();
        return { output: { periods: (data.properties?.periods ?? []).slice(0, 8), issuedAt: data.properties?.updated, retrievedAt, source: url, location: { name: resolvedLocation, latitude, longitude, source: locationSource, approximate }, note: approximate ? "This is a place-level forecast from geocoded text, not a saved field coordinate." : "This uses the farm's saved coordinates." }, source: { label: `NOAA National Weather Service forecast · ${locationSource}`, url, retrievedAt } };
      } catch { return { output: { unavailable: "The NOAA forecast is unavailable right now. Try again later; no weather estimate was substituted." } }; }
    }
    case "calculate_expected_production": {
      const field = ctx.fields.find(f => f.name.toLowerCase() === clean(a.field_name, 120).toLowerCase());
      if (!field || !finite(a.yield_bu_per_acre, 1, 500)) return { output: { error: "Use an existing field name and an explicit plausible yield assumption between 1 and 500 bu/ac." } };
      const yieldRate = a.yield_bu_per_acre as number;
      return { output: { field: field.name, acres: field.acres, assumedYieldBuPerAcre: yieldRate, estimatedBushels: expectedProduction(field.acres, yieldRate), formula: "acres × assumed yield per acre", classification: "scenario estimate; not a measured yield" }, source: farmSource(ctx, "Field acreage") };
    }
    case "compare_equipment_scenarios": {
      if (!finite(a.acres, 0.01, 100000) || !finite(a.harvest_rate_acres_per_hour, 0.01, 1000) || !finite(a.delay_hours, 0, 10000) || !finite(a.downtime_cost_per_hour, 0, 100000)) return { output: { error: "Supply acres, harvest rate, delay hours and downtime cost per hour as nonnegative numbers; harvest rate must be above zero." } };
      const acres = a.acres as number, rate = a.harvest_rate_acres_per_hour as number, delay = a.delay_hours as number, cost = a.downtime_cost_per_hour as number;
      return { output: { assumptions: { acres, harvestRateAcresPerHour: rate, delayHours: delay, downtimeCostPerHour: cost }, ...equipmentScenario(acres, rate, delay, cost), formula: "acres ÷ rate; delay × assumed downtime cost per hour", limitations: "No rental quote, yield loss, weather window or actual equipment capacity is stored. This is a scenario estimate." } };
    }
    case "propose_plan_changes": {
      const title = clean(a.title, 120), detail = clean(a.detail, 1000), risk = clean(a.risk, 400);
      if (!title || !detail || !risk || !["High", "Medium", "Low"].includes(String(a.priority)) || !date(a.due_on) || (a.estimated_cost !== null && !finite(a.estimated_cost, 0, 1_000_000))) return { output: { error: "Invalid proposal details; no plan change was made." } };
      if (!session.db || !session.userId || !session.farmId) return { output: { unavailable: "Proposals require a signed-in Supabase farm. No change was saved." } };
      const row = { conversation_id: conversationId, farm_id: session.farmId, user_id: session.userId, title, detail, due_on: a.due_on, priority: a.priority, risk, estimated_cost: a.estimated_cost };
      const saved = await session.db.from("ai_proposals").insert(row).select("id").single();
      if (saved.error) return { output: { error: "Could not save the proposal; no plan change was made." } };
      const proposal: Proposal = { id: saved.data.id, title, detail, dueOn: a.due_on as string | null, priority: a.priority as string, risk, estimatedCost: a.estimated_cost as number | null, status: "pending" };
      return { output: { proposalId: proposal.id, status: "pending farmer review", note: "Farm tasks were not changed." }, proposal };
    }
    default: return { output: { error: "Unknown tool" } };
  }
}
