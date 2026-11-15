"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, History, LoaderCircle, Plus, ShieldCheck, Sparkles, Trash2, Wrench } from "lucide-react";
import { Shell } from "@/components/shell";
import { supabase } from "@/lib/supabase-client";
import { useFarm } from "@/components/farm-provider";
import type { Proposal, Source } from "@/lib/assistant/tools";
import { VoiceInput } from "@/components/voice-input";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string; sources?: Source[] };
type Conversation = { id: string; title: string; updated_at?: string };
const suggestions = ["What should I focus on this week?", "Summarize my fields and harvest progress", "What if my combine is delayed two days?", "What information do you need to estimate corn production?"];

export default function Assistant() {
  const { hosted, refreshFarm } = useFarm();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [draft, setDraft] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [schemaReady, setSchemaReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [voiceActive,setVoiceActive]=useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const current = useRef<string | null>(null);
  useEffect(() => { current.current = currentId; }, [currentId]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, status]);

  const authFetch = useCallback(async (url: string, options?: RequestInit) => {
    const token = hosted ? (await supabase?.auth.getSession())?.data.session?.access_token : null;
    return fetch(url, { ...options, headers: { ...options?.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, cache: "no-store" });
  }, [hosted]);
  const refreshList = useCallback(async () => {
    const response = await authFetch("/api/assistant/conversations");
    const data = await response.json();
    if (response.ok) setConversations(data.conversations ?? []);
    else setError(data.error ?? "Could not load conversations.");
  }, [authFetch]);
  useEffect(() => {
    let active = true;
    void (async () => {
      const response = await authFetch("/api/assistant/config");
      const data = await response.json();
      if (active) { setConfigured(!!data.configured); setSchemaReady(data.schemaReady !== false); if (!response.ok) setError(data.error ?? "Configuration unavailable."); }
      await refreshList();
    })();
    return () => { active = false; };
  }, [authFetch, refreshList]);

  async function openConversation(id: string) {
    if (busy || voiceActive) return;
    setError(""); setStatus("Loading conversation…");
    const response = await authFetch(`/api/assistant/conversations?id=${encodeURIComponent(id)}`);
    const data = await response.json();
    setStatus("");
    if (!response.ok) { setError(data.error ?? "Could not load chat."); return; }
    setCurrentId(id);
    setMessages((data.messages ?? []).map((m: { id: string; role: "user" | "assistant"; content: string; sources: Source[] }) => ({ id: m.id, role: m.role, content: m.content, sources: m.sources })));
    setProposals((data.proposals ?? []).map((p: { id: string; title: string; detail: string; due_on: string | null; priority: string; risk: string; estimated_cost: number | null; status: string }) => ({ id: p.id, title: p.title, detail: p.detail, dueOn: p.due_on, priority: p.priority, risk: p.risk, estimatedCost: p.estimated_cost, status: p.status })));
  }
  function newChat() { if (busy || voiceActive) return; setCurrentId(null); current.current = null; setMessages([]); setProposals([]); setDraft(""); setError(""); }
  async function deleteConversation(id: string) {
    if (busy || voiceActive || !window.confirm("Delete this conversation and its proposals?")) return;
    const response = await authFetch(`/api/assistant/conversations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok || !data.deleted) { setError(data.error ?? "Could not delete chat."); return; }
    if (current.current === id) newChat();
    await refreshList();
  }
  async function reviewProposal(id: string, action: "approve" | "dismiss") {
    setError("");
    const response = await authFetch("/api/assistant/proposals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Review failed."); return; }
    setProposals(previous => previous.map(p => p.id === id ? { ...p, status: data.status } : p));
    if (action === "approve") { try { await refreshFarm(); } catch { setError("Task approved, but the farm view could not refresh. Reload the page to see it."); } }
  }
  async function sendMessage(text = draft) {
    const content = text.trim();
    if (!content || busy || voiceActive) return;
    if (!hosted || !configured || !schemaReady) { setError(!hosted ? "Connect Supabase and sign in before using AI." : !configured ? "Configure an OpenAI API key in Settings before sending messages." : "Apply the assistant database migration before sending messages."); return; }
    setDraft(""); setError(""); setBusy(true); setStatus("Connecting…");
    const userId = crypto.randomUUID(), assistantId = crypto.randomUUID();
    setMessages(previous => [...previous, { id: userId, role: "user", content }, { id: assistantId, role: "assistant", content: "", sources: [] }]);
    let received = false;
    try {
      const response = await authFetch("/api/assistant/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: content, conversationId: current.current }) });
      if (!response.ok || !response.body) { const data = await response.json(); throw new Error(data.error ?? "Could not start chat."); }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line) as { type: string; data: unknown };
          if (event.type === "conversation") { const item = event.data as { id: string }; setCurrentId(item.id); current.current = item.id; }
          if (event.type === "status") setStatus(String(event.data));
          if (event.type === "tool") setStatus(`Using ${event.data}…`);
          if (event.type === "delta") { received = true; setStatus(""); setMessages(previous => previous.map(m => m.id === assistantId ? { ...m, content: m.content + String(event.data) } : m)); }
          if (event.type === "source") setMessages(previous => previous.map(m => m.id === assistantId ? { ...m, sources: [...(m.sources ?? []), event.data as Source] } : m));
          if (event.type === "proposal") setProposals(previous => [...previous, event.data as Proposal]);
          if (event.type === "error") throw new Error(String(event.data));
          if (event.type === "done") { setStatus(""); await refreshList(); }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The assistant could not respond.");
      if (!received) setMessages(previous => previous.filter(m => m.id !== assistantId));
    } finally { setBusy(false); setStatus(""); }
  }
  return <Shell><div className="assistant-layout">
    <aside className="chat-history"><div className="chat-history-head"><strong><History size={18}/> Conversations</strong><button onClick={newChat} disabled={busy || voiceActive} aria-label="New chat" title="New chat"><Plus size={19}/></button></div><button className="new-chat" onClick={newChat} disabled={busy || voiceActive}><Plus size={17}/> New chat</button>{!hosted && <p className="chat-hint">Sign in with Supabase to save conversations.</p>}{conversations.length === 0 && <p className="chat-hint">Your saved conversations will appear here.</p>}<div className="conversation-list" style={{display:"grid",gridTemplateColumns:"minmax(0, 1fr)",minWidth:0}}> {conversations.map(c => <div className={`conversation-item ${currentId === c.id ? "selected" : ""}`} key={c.id} style={{display:"grid",gridTemplateColumns:"minmax(0, 1fr) 30px",width:"100%",minWidth:0,overflow:"hidden"}}><button title={c.title} style={{display:"block",width:"100%",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} onClick={() => openConversation(c.id)}>{c.title}</button><button onClick={() => deleteConversation(c.id)} aria-label={`Delete ${c.title}`} title="Delete conversation"><Trash2 size={14}/></button></div>)}</div></aside>
    <section className="chat-main" aria-label="AI assistant chat"><div className="chat-top"><div><div className="chat-kicker"><Sparkles size={15}/> HARVESTCOMPASS COPILOT</div><h2>Ask about your farm. Or anything else.</h2><p>Answers use saved records when relevant. You review every proposed plan change.</p></div></div>
      {!configured && <div className="chat-config"><ShieldCheck size={19}/><span>AI is waiting for a server-side API key. <Link href="/settings/ai">Open setup instructions</Link>.</span></div>}
      {!hosted && <div className="chat-config"><ShieldCheck size={19}/><span>Connect Supabase and sign in to use private, persistent chat.</span></div>}
      {!schemaReady && <div className="chat-config"><ShieldCheck size={19}/><span>The assistant database migration is pending. <Link href="/settings/ai">See setup instructions</Link>.</span></div>}
      <div className="chat-messages" aria-live="polite">{messages.length === 0 && <div className="chat-empty"><span className="chat-empty-icon"><Sparkles size={25}/></span><h3>What can I help you think through?</h3><p>Ask a general question, explore your farm records, or compare a harvest scenario.</p><div className="chat-suggestions">{suggestions.map(s => <button key={s} onClick={() => sendMessage(s)} disabled={busy || voiceActive || !hosted || !configured || !schemaReady}>{s}<ArrowUp size={15}/></button>)}</div></div>}
        {messages.map(m => <div className={`chat-bubble ${m.role}`} key={m.id}><div className="chat-bubble-role">{m.role === "user" ? "You" : "HarvestCompass"}</div>{m.content ? <div className="chat-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div> : <div className="chat-typing"><span/><span/><span/></div>}{!!m.sources?.length && <div className="chat-sources"><strong>Based on</strong>{m.sources.map((s, i) => <div key={`${s.label}-${i}`}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : <span>{s.label.replace(/saved Supabase records/g, "Your farm entries").replace(/saved records including fictional demo seed/g, "Includes demo records").replace(/fictional demo records/g, "Demo records")}</span>}{s.retrievedAt && <small> · Retrieved {new Date(s.retrievedAt).toLocaleString()}</small>}</div>)}</div>}</div>)}
        {proposals.map(p => <div className="proposal-card" key={p.id}><div className="proposal-label"><Wrench size={16}/> PLAN CHANGE · {p.status.toUpperCase()}</div><h3>{p.title}</h3><p>{p.detail}</p><div className="proposal-facts"><span>Risk: {p.risk}</span><span>Estimated cost: {p.estimatedCost === null ? "Not available" : `$${p.estimatedCost.toLocaleString()}`}</span><span>Priority: {p.priority}</span>{p.dueOn && <span>Due: {p.dueOn}</span>}</div>{p.status === "pending" && <div className="proposal-actions"><button onClick={() => reviewProposal(p.id, "approve")}>Approve and add task</button><button onClick={() => reviewProposal(p.id, "dismiss")}>Dismiss</button></div>}<small>Only approval adds this task to your action plan.</small></div>)}
        {status && <div className="chat-status"><LoaderCircle size={16} className="spin"/>{status}</div>}{error && <div className="chat-error" role="alert">{error}</div>}<div ref={end}/></div>
      <form className="chat-composer" onSubmit={e => { e.preventDefault(); void sendMessage(); }}><textarea value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} placeholder="Ask HarvestCompass anything…" rows={2} maxLength={4000} disabled={busy || voiceActive || !hosted || !configured || !schemaReady}/><div style={{display:"flex",gap:8,alignItems:"center"}}><VoiceInput disabled={busy||!hosted||!configured||!schemaReady} remaining={4000-draft.length-(draft.trim()?1:0)} authFetch={authFetch} onActiveChange={setVoiceActive} onTranscript={text=>setDraft(previous=>previous.trim()?previous.trim()+"\n"+text:text)}/><button type="submit" disabled={!draft.trim() || busy || voiceActive || !hosted || !configured || !schemaReady} aria-label="Send message"><ArrowUp size={20}/></button></div><div className="composer-note"><ShieldCheck size={13}/> You stay in control. Changes to your farm plan are only saved after you approve them.</div></form>
    </section>
  </div></Shell>;
}
