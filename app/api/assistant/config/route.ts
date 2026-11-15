import OpenAI from "openai";
import { getSession, publicError } from "@/lib/assistant/server";
export async function GET(request: Request) {
  try {
    const session = await getSession(request);
    let location: { latitude: number | null; longitude: number | null } | null = null;
    let schemaReady = !session.db;
    if (session.db) {
      const [result, chats] = await Promise.all([
        session.db.from("farms").select("latitude,longitude").eq("id", session.farmId).single(),
        session.db.from("ai_conversations").select("id").eq("user_id", session.userId).limit(1),
      ]);
      if (!result.error) location = result.data;
      schemaReady = !result.error && !chats.error;
    }
    return Response.json({ configured: !!process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || "gpt-5-mini", connection: "Not tested", keyStorage: "server environment", schemaReady, location, demo: session.demo });
  } catch (e) { return Response.json({ error: publicError(e) }, { status: 401 }); }
}
export async function POST(request: Request) {
  try {
    const session = await getSession(request);
    if (session.demo) return Response.json({ error: "Connect Supabase and sign in before testing OpenAI." }, { status: 503 });
    if (!process.env.OPENAI_API_KEY) return Response.json({ error: "Set OPENAI_API_KEY in .env.local and restart the server first." }, { status: 503 });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 15_000, maxRetries: 0 });
    await client.responses.create({ model: process.env.OPENAI_MODEL || "gpt-5-mini", input: "Reply OK.", max_output_tokens: 20, store: false });
    return Response.json({ connected: true, model: process.env.OPENAI_MODEL || "gpt-5-mini" });
  } catch (e) { return Response.json({ error: publicError(e) }, { status: 502 }); }
}
