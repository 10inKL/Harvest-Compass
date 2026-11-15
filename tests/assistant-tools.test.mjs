import test from "node:test";
import assert from "node:assert/strict";
import { runTool } from "../lib/assistant/tools.ts";

const context = {
  source: "fictional demo records",
  farm: { name: "Demo Farm", location: "South Dakota", seasonYear: 2026, latitude: null, longitude: null },
  fields: [{ id: "field-1", name: "North Quarter", crop: "Corn", acres: 320, plantedOn: "2026-05-08", status: "On track", progress: 78 }],
  equipment: [{ name: "Demo combine", status: "Needs service", note: "Demo note" }],
  tasks: [], expenses: [], sales: [],
  harvest: [{ fieldId: "field-1", harvestedOn: "2026-10-28", bushels: 60800, moisturePercent: 16.4, storageBin: "North bin" }],
};
const session = { db: null, userId: null, farmId: null, demo: true };

test("farm tools expose saved facts and demo provenance", async () => {
  const fields = await runTool("get_fields", {}, context, session, "test");
  assert.equal(fields.output[0].recordedBushels, 60800);
  assert.match(fields.source.label, /Includes demo records/);
  const harvest = await runTool("get_harvest_progress", {}, context, session, "test");
  assert.equal(harvest.output.totalHarvestedBushels, 60800);
  assert.equal(harvest.output.remainingByCropAndBin["Corn · North bin"], 60800);
  assert.equal(harvest.output.totalSoldBushels, 0);
});

test("grain context deducts recorded sales and calculates revenue without changing harvest totals", async()=>{
  const harvest=await runTool("get_harvest_progress",{}, {...context,sales:[{crop:"Corn",storageBin:"North bin",bushels:1000,pricePerBushel:4.25}]},session,"test");
  assert.equal(harvest.output.totalHarvestedBushels,60800);
  assert.equal(harvest.output.totalSoldBushels,1000);
  assert.equal(harvest.output.remainingByCropAndBin["Corn · North bin"],59800);
  assert.equal(harvest.output.recordedSalesRevenue,4250);
});

test("missing coordinates and unsupported records remain explicitly unavailable", async () => {
  const weather = await runTool("get_weather_forecast", { location: null }, { ...context, farm: { ...context.farm, location: null } }, session, "test");
  assert.match(weather.output.unavailable, /No farm coordinates or place name/);
  const profile = await runTool("get_farm_profile", {}, context, session, "test");
  assert.ok(profile.output.unavailable.includes("labor roster"));
  assert.ok(profile.output.unavailable.includes("approved budget"));
});

test("combine delay uses only stated assumptions and rejects missing rate", async () => {
  const compared = await runTool("compare_equipment_scenarios", { acres: 320, harvest_rate_acres_per_hour: 20, delay_hours: 48, downtime_cost_per_hour: 125 }, context, session, "test");
  assert.equal(compared.output.delayedCompletionHours, 64);
  assert.equal(compared.output.delayCostEstimate, 6000);
  const invalid = await runTool("compare_equipment_scenarios", { acres: 320, harvest_rate_acres_per_hour: 0, delay_hours: 48, downtime_cost_per_hour: 125 }, context, session, "test");
  assert.ok(invalid.output.error);
});

test("a demo proposal cannot silently change a plan", async () => {
  const proposal = await runTool("propose_plan_changes", { title: "Check repairs", detail: "Call service shop", due_on: null, priority: "High", risk: "Combine delay", estimated_cost: null }, context, session, "test");
  assert.match(proposal.output.unavailable, /No change was saved/);
});
