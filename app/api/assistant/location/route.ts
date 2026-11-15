import { getSession, publicError } from "@/lib/assistant/server";
export async function PATCH(request: Request) {
  try {
    const session = await getSession(request);
    if (!session.db) return Response.json({ error: "Sign in to save farm coordinates." }, { status: 400 });
    const { latitude, longitude } = await request.json() as { latitude: unknown; longitude: unknown };
    if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 24 || latitude > 50 || longitude < -125 || longitude > -66) return Response.json({ error: "Enter valid coordinates in the contiguous United States." }, { status: 400 });
    const result = await session.db.from("farms").update({ latitude, longitude }).eq("id", session.farmId).select("id").single();
    if (result.error) throw result.error;
    return Response.json({ saved: true });
  } catch (e) { return Response.json({ error: publicError(e) }, { status: 500 }); }
}
