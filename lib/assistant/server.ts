import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { initialFarmState } from "@/lib/farm-store";

export type AssistantSession = { db: SupabaseClient | null; userId: string | null; farmId: string | null; demo: boolean };
export type FarmContext = {
  source: "saved Supabase records" | "saved records including fictional demo seed" | "fictional demo records";
  farm: { name: string; location: string | null; seasonYear: number; latitude: number | null; longitude: number | null };
  fields: { id: string; name: string; crop: string; acres: number; plantedOn: string | null; status: string; progress: number }[];
  equipment: { name: string; status: string; note: string }[];
  tasks: { title: string; detail: string; dueOn: string | null; priority: string; done: boolean }[];
  expenses: { category: string; amount: number; incurredOn: string; note: string }[];
  harvest: { fieldId: string; harvestedOn: string; bushels: number; moisturePercent: number | null; storageBin: string }[];
};

export async function getSession(request: Request): Promise<AssistantSession> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { db: null, userId: null, farmId: null, demo: true };
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new Error("Sign in to use the assistant.");
  const db = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const user = await db.auth.getUser(token);
  if (user.error || !user.data.user) throw new Error("Your session expired. Sign in again.");
  const membership = await db.from("farm_members").select("farm_id").eq("user_id", user.data.user.id).limit(1).maybeSingle();
  if (membership.error || !membership.data) throw new Error("No farm workspace is available for this account.");
  return { db, userId: user.data.user.id, farmId: membership.data.farm_id, demo: false };
}

export async function getFarmContext(session: AssistantSession): Promise<FarmContext> {
  if (!session.db || !session.farmId) return {
    source: "fictional demo records",
    farm: { name: initialFarmState.farmName, location: "Brookings County, South Dakota", seasonYear: 2026, latitude: null, longitude: null },
    fields: initialFarmState.fields.map(f => ({ id: f.id, name: f.name, crop: f.crop, acres: f.acres, plantedOn: f.planted, status: f.status, progress: f.progress })),
    equipment: initialFarmState.equipment.map(e => ({ name: e.name, status: e.status, note: e.note })),
    tasks: initialFarmState.tasks.map(t => ({ title: t.title, detail: t.detail, dueOn: t.due, priority: t.priority, done: t.done })),
    expenses: initialFarmState.expenses.map(e => ({ category: e.category, amount: e.amount, incurredOn: e.date, note: e.note })),
    harvest: [],
  };
  const db = session.db;
  const id = session.farmId;
  const results = await Promise.all([
    db.from("farms").select("name,location,season_year,latitude,longitude,demo_seeded").eq("id", id).single(),
    db.from("fields").select("id,name,crop,acres,planted_on,status,progress").eq("farm_id", id),
    db.from("equipment").select("name,status,note").eq("farm_id", id),
    db.from("farm_tasks").select("title,detail,due_on,priority,done").eq("farm_id", id),
    db.from("expenses").select("category,amount,incurred_on,note").eq("farm_id", id),
    db.from("harvest_entries").select("field_id,harvested_on,bushels,moisture_percent,storage_bin").eq("farm_id", id),
  ]);
  for (const result of results) if (result.error) throw new Error(`Could not load farm records: ${result.error.message}`);
  const [farm, fields, equipment, tasks, expenses, harvest] = results.map(r => r.data);
  const f = farm as { name: string; location: string | null; season_year: number; latitude: number | null; longitude: number | null; demo_seeded: boolean };
  return {
    source: f.demo_seeded ? "saved records including fictional demo seed" : "saved Supabase records",
    farm: { name: f.name, location: f.location, seasonYear: f.season_year, latitude: f.latitude === null ? null : Number(f.latitude), longitude: f.longitude === null ? null : Number(f.longitude) },
    fields: ((fields ?? []) as { id: string; name: string; crop: string; acres: number; planted_on: string | null; status: string; progress: number }[]).map(x => ({ id: x.id, name: x.name, crop: x.crop, acres: Number(x.acres), plantedOn: x.planted_on, status: x.status, progress: x.progress })),
    equipment: (equipment ?? []) as FarmContext["equipment"],
    tasks: ((tasks ?? []) as { title: string; detail: string; due_on: string | null; priority: string; done: boolean }[]).map(x => ({ title: x.title, detail: x.detail, dueOn: x.due_on, priority: x.priority, done: x.done })),
    expenses: ((expenses ?? []) as { category: string; amount: number; incurred_on: string; note: string }[]).map(x => ({ category: x.category, amount: Number(x.amount), incurredOn: x.incurred_on, note: x.note })),
    harvest: ((harvest ?? []) as { field_id: string; harvested_on: string; bushels: number; moisture_percent: number | null; storage_bin: string }[]).map(x => ({ fieldId: x.field_id, harvestedOn: x.harvested_on, bushels: Number(x.bushels), moisturePercent: x.moisture_percent === null ? null : Number(x.moisture_percent), storageBin: x.storage_bin })),
  };
}

export function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : "The assistant could not complete this request.";
  if (message.includes("session") || message.includes("Sign in") || message.includes("farm workspace")) return message;
  if (message.includes("ai_conversations") || message.includes("ai_messages") || message.includes("ai_proposals") || message.includes("latitude")) return "The assistant database migration has not been applied yet. See Settings → AI Configuration.";
  if (message.includes("Could not load farm records")) return message;
  return "The assistant could not complete this request. Check the model and API configuration, then try again.";
}
