"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Check, Info, MapPinned, MousePointer2, Satellite, Save, Wheat } from "lucide-react";
import { Shell } from "@/components/shell";
import { useFarm } from "@/components/farm-provider";
import { newId } from "@/lib/farm-store";
import { candidateFields, type CandidateField } from "@/lib/map-data";

const FarmMapCanvas = dynamic(() => import("@/components/farm-map-canvas").then((m) => m.FarmMapCanvas), { ssr: false, loading: () => <div className="map-empty">Loading satellite map…</div> });
function toGeoJson(c: CandidateField) { return { type: "Polygon" as const, coordinates: [[...c.coordinates.map(([lat, lng]) => [lng, lat])]] }; }

export default function FarmMap() {
  const { data, saveRecord, busy } = useFarm();
  const [selected, setSelected] = useState<CandidateField | null>(null);
  const [fieldName, setFieldName] = useState(""); const [crop, setCrop] = useState<CandidateField["crop"]>("Corn"); const [saved, setSaved] = useState(false);
  const savedBoundaries = useMemo(() => data.fields.filter((field) => field.boundaryConfirmed), [data.fields]);
  function selectCandidate(c: CandidateField) { setSelected(c); setFieldName(c.name.replace(" candidate", "")); setCrop(c.crop); setSaved(false); }
  async function confirmBoundary() {
    if (!selected || !fieldName.trim()) return;
    const existing = data.fields.find((field) => field.name.toLowerCase() === fieldName.trim().toLowerCase());
    const ok = await saveRecord("fields", { id: existing?.id ?? newId(), name: fieldName.trim(), crop, acres: selected.acres, planted: existing?.planted ?? "Not set", status: existing?.status ?? "Planned", progress: existing?.progress ?? 0, boundaryGeoJson: toGeoJson(selected), boundarySource: selected.source, boundaryConfirmed: true });
    if (ok) setSaved(true);
  }
  return <Shell>
    <div className="map-hero"><div><div className="map-kicker"><MapPinned size={14}/> Boundary workspace · Demo data</div><h1>Turn the landscape into a field plan.</h1><p>Select a suggested agricultural boundary from the satellite view, confirm its crop and name, and save it to your farm records.</p></div><div className="map-hero-badge"><Satellite size={17}/><span>Satellite + street layers</span></div></div>
    <div className="map-layout"><section className="map-panel"><div className="map-toolbar"><span><MousePointer2 size={15}/> Select a highlighted polygon</span><span>{candidateFields.length} suggested areas</span></div><FarmMapCanvas candidates={candidateFields} selectedId={selected?.id ?? null} onSelect={selectCandidate}/></section>
      <aside className="map-side"><div className="map-side-card"><div className="map-side-heading"><Info size={16}/><span>How this works</span></div><ol><li>Click a highlighted area on the map.</li><li>Review the crop and acreage estimate.</li><li>Confirm the field name to save it.</li></ol><p className="map-disclaimer">These are demo suggested boundaries for the Brookings County view, not legal ownership or survey lines. Confirm before using them for operations.</p></div>
        {selected ? <div className="map-select-card"><div className="map-side-heading"><Check size={16}/><span>Confirm selected area</span></div><div className="map-selection-name">{selected.name}</div><label>Field name<input value={fieldName} onChange={(e) => setFieldName(e.target.value)} /></label><label>Crop<select value={crop} onChange={(e) => setCrop(e.target.value as CandidateField["crop"])}><option value="Corn">Corn</option><option value="Soybeans">Soybeans</option></select></label><div className="map-acreage"><Wheat size={15}/><span>{selected.acres} estimated acres</span></div><button className="primary-button" onClick={confirmBoundary} disabled={busy || !fieldName.trim()}><Save size={15}/>{busy ? "Saving…" : "Confirm and save field"}</button>{saved && <p className="map-saved-message">Saved to your farm records. This boundary now flows into operations and AI context.</p>}</div> : <div className="map-side-card map-empty-side"><MousePointer2 size={20}/><strong>Choose a boundary</strong><p>Click any outlined field to begin.</p></div>}
      </aside></div>
    <section className="map-saved"><div className="section-heading"><div><span className="eyebrow">SAVED FIELDS</span><h2>Confirmed boundaries</h2></div><span className="muted">{savedBoundaries.length} mapped</span></div>{savedBoundaries.length ? <div className="map-saved-list">{savedBoundaries.map((field) => <div className="map-saved-row" key={field.id}><div><strong>{field.name}</strong><span>{field.crop} · {field.acres} acres</span></div><span className="map-confirmed"><Check size={13}/> Confirmed</span></div>)}</div> : <p className="map-empty-copy">No boundaries confirmed yet. The saved fields below will be available to your operations and assistant views.</p>}</section>
  </Shell>;
}
