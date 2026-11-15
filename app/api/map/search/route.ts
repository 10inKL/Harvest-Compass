import { getSession } from "@/lib/assistant/server";

export async function GET(request: Request) {
  try {
    await getSession(request);
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (query.length < 3 || query.length > 120) return Response.json({ results: [] });
    const key = process.env.GEOAPIFY_API_KEY;
    if (!key) return Response.json({ results: [], error: "Location suggestions need a Geoapify free-tier API key." });
    const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
    url.searchParams.set("text", query); url.searchParams.set("filter", "countrycode:us"); url.searchParams.set("limit", "6"); url.searchParams.set("apiKey", key);
    const response = await fetch(url, { next: { revalidate: 300 } });
    if (!response.ok) return Response.json({ results: [], error: "Location search is temporarily unavailable." }, { status: 502 });
    const data = await response.json() as { features?: { properties: { formatted?: string; state?: string; country?: string; lat?: number; lon?: number } }[] };
    return Response.json({ results: (data.features ?? []).filter(f => Number.isFinite(f.properties.lat) && Number.isFinite(f.properties.lon)).map(f => ({ label: f.properties.formatted ?? `${f.properties.state}, ${f.properties.country}`, latitude: f.properties.lat, longitude: f.properties.lon })) });
  } catch { return Response.json({ results: [], error: "Sign in to search locations." }, { status: 401 }); }
}
