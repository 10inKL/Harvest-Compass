"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CloudSun, ExternalLink, KeyRound, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Shell } from "@/components/shell";
import { supabase } from "@/lib/supabase-client";
import { useFarm } from "@/components/farm-provider";

type Config = { configured: boolean; model: string; connection: string; keyStorage: string; schemaReady: boolean; location: { latitude: number | null; longitude: number | null } | null; demo: boolean };
export default function AISettings() {
  const { hosted } = useFarm();
  const [config, setConfig] = useState<Config | null>(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [connection, setConnection] = useState("Not tested");
  const [error, setError] = useState("");
  const authFetch = useCallback(async (url: string, options?: RequestInit) => {
    const token = hosted ? (await supabase?.auth.getSession())?.data.session?.access_token : null;
    return fetch(url, { ...options, headers: { ...options?.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, cache: "no-store" });
  }, [hosted]);
  useEffect(() => { void (async () => { const response = await authFetch("/api/assistant/config"); const data = await response.json(); if (response.ok) { setConfig(data); setLatitude(data.location?.latitude?.toString() ?? ""); setLongitude(data.location?.longitude?.toString() ?? ""); } else setError(data.error ?? "Configuration unavailable."); })(); }, [authFetch]);
  async function testConnection() {
    setTesting(true); setNotice(""); setError("");
    try { const response = await authFetch("/api/assistant/config", { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Connection test failed."); setConnection("Connected"); setNotice(`Connected to OpenAI using ${data.model}.`); }
    catch (e) { setConnection("Test failed"); setError(e instanceof Error ? e.message : "Connection test failed."); }
    finally { setTesting(false); }
  }
  async function saveLocation(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setNotice(""); setError("");
    try { const response = await authFetch("/api/assistant/location", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latitude: Number(latitude), longitude: Number(longitude) }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Could not save coordinates."); setNotice("Farm coordinates saved. Weather forecasts can now use this location."); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save coordinates."); }
    finally { setSaving(false); }
  }
  return <Shell><div className="settings-page"><div className="demo-label">SETTINGS · AI CONFIGURATION</div><div className="settings-hero"><span><Sparkles size={22}/></span><div><h2>Connect your farm copilot</h2><p>Keep the OpenAI key on the server. Your browser only receives whether the integration is configured.</p></div></div>
    <div className="settings-grid"><section className="settings-card"><div className="settings-card-heading"><KeyRound size={20}/><div><h3>OpenAI connection</h3><p>Server environment configuration</p></div></div><div className="settings-status"><span className={config?.configured ? "status-dot on" : "status-dot"}/><strong>{config?.configured ? "Key configured" : "Key not configured"}</strong><span>Model: {config?.model ?? "Loading…"}</span></div><p className="settings-fine">Connection: {connection}</p><p className="settings-copy"><strong>Save key locally:</strong> open the project’s <code>.env.local</code> file in VS Code and add:</p><pre className="settings-code">OPENAI_API_KEY=your_key_here{"\n"}OPENAI_MODEL=gpt-5-mini</pre><p className="settings-copy">Save the file and restart <code>npm run dev</code>. <strong>Remove key:</strong> delete the <code>OPENAI_API_KEY</code> line and restart. For deployment, set these as server environment variables in your hosting provider.</p><div className="settings-note"><ShieldCheck size={18}/><span>In-app key saving is unavailable because this project has no encrypted secret store. No key is stored in the browser, Supabase, or GitHub.</span></div><button className="primary-button" onClick={testConnection} disabled={!hosted || !config?.configured || testing}>{testing ? <LoaderCircle size={16} className="spin"/> : <CheckCircle2 size={16}/>} Test connection</button><p className="settings-fine">This button makes a small live OpenAI request only when you click it.</p></section>
    <section className="settings-card"><div className="settings-card-heading"><CloudSun size={20}/><div><h3>Farm forecast location</h3><p>Coordinates for NOAA National Weather Service</p></div></div><p className="settings-copy">Enter the coordinates of your farm or nearest representative field. We do not infer precise coordinates from your county name.</p><form onSubmit={saveLocation} className="coordinates-form"><label>Latitude<input type="number" step="any" min="24" max="50" required value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="e.g. 44.3"/></label><label>Longitude<input type="number" step="any" min="-125" max="-66" required value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="e.g. -96.8"/></label><button className="primary-button" disabled={!hosted || saving}>{saving ? <LoaderCircle size={16} className="spin"/> : null} Save coordinates</button></form>{!hosted && <p className="settings-fine">Connect Supabase to save farm coordinates.</p>}<p className="settings-copy">Forecasts come from <a href="https://www.weather.gov/documentation/services-web-api" target="_blank" rel="noreferrer">NOAA/NWS <ExternalLink size={12}/></a> and include their retrieval time. If the service is unavailable, the assistant says so.</p></section></div>
    {config && !config.schemaReady && hosted && <p className="chat-config">Database setup pending: apply <code>supabase/migrations/202611150002_assistant.sql</code> in your Supabase SQL Editor before using chat or saving coordinates.</p>}{notice && <p className="settings-success" role="status">{notice}</p>}{error && <p className="chat-error" role="alert">{error}</p>}<Link className="settings-back" href="/ai-assistant">← Back to AI Assistant</Link></div></Shell>;
}
