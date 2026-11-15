"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Check, Eraser, Info, MapPinned, MousePointer2, Pencil, Satellite, Save, Wheat } from "lucide-react";
import { Shell } from "@/components/shell";
import { useFarm } from "@/components/farm-provider";
import { newId } from "@/lib/farm-store";
import { candidateFields, type CandidateField } from "@/lib/map-data";
import { supabase } from "@/lib/supabase-client";

const FarmMapCanvas = dynamic(() => import("@/components/farm-map-canvas").then((m) => m.FarmMapCanvas), { ssr: false, loading: () => <div className="map-empty">Loading satellite map…</div> });
function toGeoJson(c: CandidateField) { return { type: "Polygon" as const, coordinates: [[...c.coordinates.map(([lat, lng]) => [lng, lat])]] }; }
function estimateAcres(points: [number, number][]) {
  const lat = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const scaleX = 111320 * Math.cos((lat * Math.PI) / 180); const scaleY = 110540;
  let area = 0;
  for (let i = 0; i < points.length - 1; i += 1) { const [y1, x1] = points[i]; const [y2, x2] = points[i + 1]; area += (x1 * scaleX) * (y2 * scaleY) - (x2 * scaleX) * (y1 * scaleY); }
  return Math.max(1, Math.round(Math.abs(area) / 2 / 4046.86));
}
function cropFromCdl(value: unknown): CandidateField["crop"] { return Number(value) === 5 ? "Soybeans" : "Corn"; }

export default function FarmMap() {
  const { data, saveRecord, busy } = useFarm();
  const [selected, setSelected] = useState<CandidateField | null>(null);
  const [fieldName, setFieldName] = useState(""); const [crop, setCrop] = useState<CandidateField["crop"]>("Corn"); const [saved, setSaved] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [mapCandidates, setMapCandidates] = useState<CandidateField[]>(candidateFields);
  const [dataStatus, setDataStatus] = useState("Demo suggestions loaded");
  const savedBoundaries = useMemo(() => data.fields.filter((field) => field.boundaryConfirmed), [data.fields]);
  useEffect(() => {
    let active = true;
    async function loadUsdaFields() {
      if (!supabase) return;
      const session = await supabase.auth.getSession(); const token = session.data.session?.access_token;
      if (!token) return;
      const response = await fetch("/api/map/fields?minLng=-96.90&minLat=44.20&maxLng=-96.65&maxLat=44.40", { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return;
      const collection = await response.json() as { features?: { id: string; geometry?: { coordinates?: number[][][][] }; properties?: Record<string, unknown> }[] };
      const fields = (collection.features ?? []).map((feature) => {
        const ring = feature.geometry?.coordinates?.[0]?.[0] ?? []; const properties = feature.properties ?? {};
        return { id: feature.id, name: `USDA estimated field ${feature.id}`, crop: cropFromCdl(properties.crop2025), acres: Number(properties.acres ?? 0), source: "USDA NASS Crop Sequence Boundaries 2018-2025 (estimated)", coordinates: ring.map(([lng, lat]) => [lat, lng] as [number, number]) };
      }).filter((field) => field.coordinates.length >= 4 && field.acres > 0);
      if (active && fields.length) { setMapCandidates(fields); setDataStatus(`${fields.length.toLocaleString()} USDA estimated boundaries loaded`); }
    }
    void loadUsdaFields(); return () => { active = false; };
  }, []);
  function selectCandidate(c: CandidateField) { setSelected(c); setFieldName(c.name.replace(" candidate", "")); setCrop(c.crop); setSaved(false); }
  function startDrawing() { setSelected(null); setSaved(false); setDrawing(true); setFieldName("New field"); }
  function finishDrawing() { window.dispatchEvent(new Event("harvestcompass:finish-drawing")); }
  function acceptDrawnBoundary(coordinates: [number, number][]) { setDrawing(false); setSelected({ id: "manual-boundary", name: "New field", crop, acres: estimateAcres(coordinates), source: "Farmer-drawn boundary", coordinates }); }
  async function confirmBoundary() {
    if (!selected || !fieldName.trim()) return;
    const existing = data.fields.find((field) => field.name.toLowerCase() === fieldName.trim().toLowerCase());
    const ok = await saveRecord("fields", { id: existing?.id ?? newId(), name: fieldName.trim(), crop, acres: selected.acres, planted: existing?.planted ?? "Not set", status: existing?.status ?? "Planned", progress: existing?.progress ?? 0, boundaryGeoJson: toGeoJson(selected), boundarySource: selected.source, boundaryConfirmed: true });
    if (ok) setSaved(true);
  }
  return <Shell>
    <div className="map-hero"><div><div className="map-kicker"><MapPinned size={14}/> Boundary workspace · USDA pilot</div><h1>Turn the landscape into a field plan.</h1><p>Select an estimated USDA agricultural boundary from the satellite view, confirm its crop and name, and save it to your farm records.</p></div><div className="map-hero-badge"><Satellite size={17}/><span>Satellite + street layers</span></div></div>
    <div className="map-layout"><section className="map-panel"><div className="map-toolbar"><span>{drawing ? <><Pencil size={15}/> Click corners around your field</> : <><MousePointer2 size={15}/> Select an estimated USDA boundary or draw your own</>}</span><span className="map-toolbar-actions"><span className="map-data-status">{dataStatus}</span><button className="map-tool-button" onClick={drawing ? finishDrawing : startDrawing}>{drawing ? <><Check size={14}/> Finish boundary</> : <><Pencil size={14}/> Draw my boundary</>}</button>{drawing && <button className="map-tool-button secondary" onClick={() => setDrawing(false)}><Eraser size={14}/> Cancel</button>}</span></div><FarmMapCanvas candidates={mapCandidates} selectedId={selected?.id ?? null} onSelect={selectCandidate} drawing={drawing} onDrawComplete={acceptDrawnBoundary}/></section>
      <aside className="map-side"><div className="map-side-card"><div className="map-side-heading"><Info size={16}/><span>How this works</span></div><ol><li>Click a highlighted area on the map.</li><li>Review the crop and acreage estimate.</li><li>Confirm the field name to save it.</li></ol><p className="map-disclaimer">These are demo suggested boundaries for the Brookings County view, not legal ownership or survey lines. Confirm before using them for operations.</p></div>
        {selected ? <div className="map-select-card"><div className="map-side-heading"><Check size={16}/><span>Confirm selected area</span></div><div className="map-selection-name">{selected.name}</div><label>Field name<input value={fieldName} onChange={(e) => setFieldName(e.target.value)} /></label><label>Crop<select value={crop} onChange={(e) => setCrop(e.target.value as CandidateField["crop"])}><option value="Corn">Corn</option><option value="Soybeans">Soybeans</option></select></label><div className="map-acreage"><Wheat size={15}/><span>{selected.acres} estimated acres</span></div><button className="primary-button" onClick={confirmBoundary} disabled={busy || !fieldName.trim()}><Save size={15}/>{busy ? "Saving…" : "Confirm and save field"}</button>{saved && <p className="map-saved-message">Saved to your farm records. This boundary now flows into operations and AI context.</p>}</div> : <div className="map-side-card map-empty-side"><MousePointer2 size={20}/><strong>Choose a boundary</strong><p>Click any outlined field to begin.</p></div>}
      </aside></div>
    <section className="map-saved"><div className="section-heading"><div><span className="eyebrow">SAVED FIELDS</span><h2>Confirmed boundaries</h2></div><span className="muted">{savedBoundaries.length} mapped</span></div>{savedBoundaries.length ? <div className="map-saved-list">{savedBoundaries.map((field) => <div className="map-saved-row" key={field.id}><div><strong>{field.name}</strong><span>{field.crop} · {field.acres} acres</span></div><span className="map-confirmed"><Check size={13}/> Confirmed</span></div>)}</div> : <p className="map-empty-copy">No boundaries confirmed yet. The saved fields below will be available to your operations and assistant views.</p>}</section>
  </Shell>;
}
