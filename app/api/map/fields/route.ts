import { getSession } from "@/lib/assistant/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { geometryAcres } from "@/lib/geo-area";
import type { BoundaryGeometry } from "@/lib/map-data";

type Feature = { type: "Feature"; id: string; geometry: BoundaryGeometry; properties: Record<string, unknown> };
type Collection = { type: "FeatureCollection"; features: Feature[]; truncated?: boolean };

async function visibleFeatures(bounds: number[], fetchBox: (box: number[]) => Promise<Collection>, depth = 0): Promise<Collection> {
  const result = await fetchBox(bounds);
  if (result.features.length < 500) return result;
  if (depth >= 2) return { ...result, truncated: true };
  const [west, south, east, north] = bounds;
  const middleLng = (west + east) / 2;
  const middleLat = (south + north) / 2;
  const quarters = [
    [west, south, middleLng, middleLat], [middleLng, south, east, middleLat],
    [west, middleLat, middleLng, north], [middleLng, middleLat, east, north],
  ];
  const results = await Promise.all(quarters.map((quarter) => visibleFeatures(quarter, fetchBox, depth + 1)));
  const unique = new Map<string, Feature>();
  for (const child of results) for (const feature of child.features) unique.set(feature.id, feature);
  const features = [...unique.values()].slice(0, 2500);
  return { type: "FeatureCollection", features, truncated: results.some(child => child.truncated) || unique.size > 2500 };
}

function localFeatures(bounds: number[]) {
  const selectedPath = join(process.cwd(), "data", "csb", "south-dakota-selected-counties.sqlite");
  const originalPath = join(process.cwd(), "data", "csb", "south-dakota-csb.sqlite");
  const path = existsSync(selectedPath) ? selectedPath : originalPath;
  if (!existsSync(path)) return null;
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const rows = db.prepare("select f.csbid, f.acres, f.crop2025, f.geometry from bounds b join fields f on f.id=b.id where b.max_lng >= ? and b.min_lng <= ? and b.max_lat >= ? and b.min_lat <= ? limit 500").all(bounds[0], bounds[2], bounds[1], bounds[3]) as { csbid: string; acres: number; crop2025: number; geometry: Uint8Array }[];
    return { type: "FeatureCollection" as const, features: rows.map(row => { const geometry = JSON.parse(inflateSync(row.geometry).toString()) as BoundaryGeometry; return { type: "Feature" as const, id: row.csbid, geometry, properties: { acres: geometryAcres(geometry), usdaAcres: row.acres, crop2025: row.crop2025, source: "USDA NASS CSB 2018-2025 (estimated)" } }; }) };
  } finally { db.close(); }
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const values = ["minLng", "minLat", "maxLng", "maxLat"].map((key) => params.has(key) ? Number(params.get(key)) : Number.NaN);
    if (values.some((value) => !Number.isFinite(value))) return Response.json({ error: "A valid bounding box is required." }, { status: 400 });
    const [minLng, minLat, maxLng, maxLat] = values;
    if (minLng >= maxLng || minLat >= maxLat || minLng < -125 || maxLng > -66 || minLat < 24 || maxLat > 50 || maxLng - minLng > 1 || maxLat - minLat > 1) return Response.json({ error: "Map area is invalid or too large. Zoom in and try again." }, { status: 400 });
    const session = await getSession(request);
    if (session.db) {
      try {
        const db = session.db;
        const collection = await visibleFeatures(values, async ([west, south, east, north]) => {
          const result = await db.rpc("get_csb_boundaries_geojson", { min_lng: west, min_lat: south, max_lng: east, max_lat: north });
          if (result.error) throw result.error;
          return result.data as Collection;
        });
        return Response.json(collection, { headers: { "Cache-Control": "private, max-age=30", "X-Boundary-Source": "Supabase PostGIS" } });
      } catch { /* Use the verified local USDA index when the hosted service is unavailable. */ }
    }
    if (localFeatures(values)) {
      const local = await visibleFeatures(values, async (box) => localFeatures(box) as Collection);
      return Response.json(local, { headers: { "Cache-Control": "private, max-age=30", "X-Boundary-Source": "local USDA index" } });
    }
    return Response.json({ error: "USDA boundaries are not available on this server yet." }, { status: 503 });
  } catch (error) {
    const unauthorized = error instanceof Error && /Sign in|session expired|farm workspace/.test(error.message);
    return Response.json({ error: unauthorized ? "Sign in to load field boundaries." : "Could not load field boundaries. Try again." }, { status: unauthorized ? 401 : 500 });
  }
}
