import { getSession, publicError } from "@/lib/assistant/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { DatabaseSync } from "node:sqlite";

function localFeatures(bounds: number[]) {
  const path = join(process.cwd(), "data", "csb", "south-dakota-csb.sqlite");
  if (!existsSync(path)) return null;
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const rows = db.prepare("select f.csbid, f.acres, f.crop2025, f.geometry from bounds b join fields f on f.id=b.id where b.max_lng >= ? and b.min_lng <= ? and b.max_lat >= ? and b.min_lat <= ? limit 500").all(bounds[0], bounds[2], bounds[1], bounds[3]) as { csbid: string; acres: number; crop2025: number; geometry: Uint8Array }[];
    return { type: "FeatureCollection", features: rows.map(row => ({ type: "Feature", id: row.csbid, geometry: JSON.parse(inflateSync(row.geometry).toString()), properties: { acres: row.acres, crop2025: row.crop2025, source: "USDA NASS CSB 2018-2025 (estimated)" } })) };
  } finally { db.close(); }
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const values = ["minLng", "minLat", "maxLng", "maxLat"].map((key) => params.has(key) ? Number(params.get(key)) : Number.NaN);
    if (values.some((value) => !Number.isFinite(value))) return Response.json({ error: "A valid bounding box is required." }, { status: 400 });
    const [minLng, minLat, maxLng, maxLat] = values;
    if (minLng >= maxLng || minLat >= maxLat || minLng < -125 || maxLng > -66 || minLat < 24 || maxLat > 50 || maxLng - minLng > 1 || maxLat - minLat > 1) return Response.json({ error: "Map area is invalid or too large. Zoom in and try again." }, { status: 400 });
    const local = localFeatures(values);
    if (local) return Response.json(local, { headers: { "Cache-Control": "private, max-age=30" } });
    const session = await getSession(request);
    if (!session.db) return Response.json({ error: "USDA boundaries have not been imported on this server." }, { status: 503 });
    const result = await session.db.rpc("get_csb_boundaries_geojson", { min_lng: minLng, min_lat: minLat, max_lng: maxLng, max_lat: maxLat });
    if (result.error) throw result.error;
    return Response.json(result.data ?? { type: "FeatureCollection", features: [] }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch (error) {
    return Response.json({ error: publicError(error) }, { status: 500 });
  }
}
