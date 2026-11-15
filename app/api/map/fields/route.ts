import { getSession, publicError } from "@/lib/assistant/server";

export async function GET(request: Request) {
  try {
    const session = await getSession(request);
    if (!session.db) return Response.json({ error: "Sign in to load USDA field estimates." }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const values = ["minLng", "minLat", "maxLng", "maxLat"].map((key) => params.has(key) ? Number(params.get(key)) : Number.NaN);
    if (values.some((value) => !Number.isFinite(value))) return Response.json({ error: "A valid bounding box is required." }, { status: 400 });
    const [minLng, minLat, maxLng, maxLat] = values;
    if (minLng >= maxLng || minLat >= maxLat || minLng < -125 || maxLng > -66 || minLat < 24 || maxLat > 50 || maxLng - minLng > 1 || maxLat - minLat > 1) return Response.json({ error: "Map area is invalid or too large. Zoom in and try again." }, { status: 400 });
    const result = await session.db.rpc("get_csb_boundaries_geojson", { min_lng: minLng, min_lat: minLat, max_lng: maxLng, max_lat: maxLat });
    if (result.error) throw result.error;
    return Response.json(result.data ?? { type: "FeatureCollection", features: [] }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch (error) {
    return Response.json({ error: publicError(error) }, { status: 500 });
  }
}
