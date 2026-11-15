import { getSession, publicError } from "@/lib/assistant/server";

export async function GET(request: Request) {
  try {
    const session = await getSession(request);
    if (!session.db) return Response.json({ conversations: [], messages: [], proposals: [], persisted: false });
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      const result = await session.db.from("ai_conversations").select("id,title,updated_at").eq("user_id", session.userId).eq("farm_id", session.farmId).order("updated_at", { ascending: false }).limit(50);
      if (result.error) throw result.error;
      return Response.json({ conversations: result.data, persisted: true });
    }
    const own = await session.db.from("ai_conversations").select("id").eq("id", id).eq("user_id", session.userId).eq("farm_id", session.farmId).single();
    if (own.error) return Response.json({ error: "Conversation not found." }, { status: 404 });
    const [messages, proposals] = await Promise.all([
      session.db.from("ai_messages").select("id,role,content,sources,created_at").eq("conversation_id", id).eq("user_id", session.userId).order("created_at"),
      session.db.from("ai_proposals").select("id,title,detail,due_on,priority,risk,estimated_cost,status,created_at").eq("conversation_id", id).eq("user_id", session.userId).order("created_at"),
    ]);
    if (messages.error) throw messages.error;
    if (proposals.error) throw proposals.error;
    return Response.json({ messages: messages.data, proposals: proposals.data, persisted: true });
  } catch (e) { return Response.json({ error: publicError(e) }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession(request);
    if (!session.db) return Response.json({ error: "Sign in to manage saved chats." }, { status: 400 });
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Conversation ID required." }, { status: 400 });
    const deleted = await session.db.from("ai_conversations").delete({ count: "exact" }).eq("id", id).eq("user_id", session.userId).eq("farm_id", session.farmId);
    if (deleted.error) throw deleted.error;
    return Response.json({ deleted: deleted.count === 1 });
  } catch (e) { return Response.json({ error: publicError(e) }, { status: 500 }); }
}
