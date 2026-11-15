import { getSession, publicError } from "@/lib/assistant/server";
export async function POST(request: Request) {
  try {
    const session = await getSession(request);
    if (!session.db) return Response.json({ error: "Sign in to review proposals." }, { status: 400 });
    const body = await request.json() as { id?: string; action?: string };
    if (!body.id || !["approve", "dismiss"].includes(body.action ?? "")) return Response.json({ error: "Choose a proposal and action." }, { status: 400 });
    if (body.action === "approve") {
      const result = await session.db.rpc("approve_ai_proposal", { proposal_id: body.id });
      if (result.error) return Response.json({ error: "This proposal could not be approved. It may have already been reviewed." }, { status: 409 });
      return Response.json({ status: "approved", taskId: result.data });
    }
    const result = await session.db.from("ai_proposals").update({ status: "dismissed", reviewed_at: new Date().toISOString() }).eq("id", body.id).eq("user_id", session.userId).eq("farm_id", session.farmId).eq("status", "pending").select("id").maybeSingle();
    if (result.error || !result.data) return Response.json({ error: "This proposal could not be dismissed." }, { status: 409 });
    return Response.json({ status: "dismissed" });
  } catch (e) { return Response.json({ error: publicError(e) }, { status: 500 }); }
}
