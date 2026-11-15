"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Check, Eraser, Info, MapPinned, MousePointer2, Pencil, Satellite, Save, Search, Wheat } from "lucide-react";
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
  const [mapCandidates, setMapCandidates] = useState<CandidateField[]>(supabase ? [] : candidateFields);
  const [dataStatus, setDataStatus] = useState(supabase ? "Loading USDA boundaries…" : "Demo suggestions loaded");
  const [bbox, setBbox] = useState<[number, number, number, number] | null>(null);
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [search, setSearch] = useState("");
  const [locations, setLocations] = useState<{ label: string; latitude: number; longitude: number }[]>([]);
  const savedBoundaries = useMemo(() => data.fields.filter((field) => field.boundaryConfirmed), [data.fields]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      const match = search.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (match) { const latitude = Number(match[1]), longitude = Number(match[2]); setLocations(latitude >= 24 && latitude <= 50 && longitude >= -125 && longitude <= -66 ? [{ label: `${latitude}, ${longitude} · coordinates`, latitude, longitude }] : []); return; }
      if (search.trim().length < 3) { setLocations([]); return; }
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      const response = await fetch(`/api/map/search?q=${encodeURIComponent(search)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const result = await response.json(); if (active) setLocations(result.results ?? []);
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [search]);
  useEffect(() => {
    let active = true;
    async function loadUsdaFields() {
      if (!bbox) return;
      const [minLng, minLat, maxLng, maxLat] = bbox;
      if (maxLat < 42.47 || minLat > 45.95 || maxLng < -104.06 || minLng > -96.43) { setMapCandidates([]); setDataStatus("Agricultural field boundary data is currently available for South Dakota only."); return; }
      if (!supabase) { const inBrookings = minLng < -96.78 && maxLng > -96.78 && minLat < 44.28 && maxLat > 44.28; setMapCandidates(inBrookings ? candidateFields : []); setDataStatus(inBrookings ? "Demo suggestions loaded" : "Demo boundaries are available near Brookings only."); return; }
      if (maxLng - minLng > 1 || maxLat - minLat > 1) { setMapCandidates([]); setDataStatus("Zoom in to load estimated USDA fields."); return; }
      const session = await supabase.auth.getSession(); const token = session.data.session?.access_token;
      if (!token) return;
      const response = await fetch(`/api/map/fields?minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) { if (active) setDataStatus("USDA boundary import is not available yet."); return; }
      const collection = await response.json() as { features?: { id: string; geometry?: { type: string; coordinates?: number[][][][] | number[][][] }; properties?: Record<string, unknown> }[] };
      const fields = (collection.features ?? []).map((feature) => {
        const polygon = feature.geometry?.coordinates?.[0]; const ring = feature.geometry?.type === "MultiPolygon" ? (polygon as number[][][] | undefined)?.[0] ?? [] : polygon as number[][] | undefined ?? []; const properties = feature.properties ?? {};
        return { id: feature.id, name: `USDA estimated field ${feature.id}`, crop: cropFromCdl(properties.crop2025), acres: Number(properties.acres ?? 0), source: "USDA NASS Crop Sequence Boundaries 2018-2025 (estimated)", coordinates: ring.map(([lng, lat]) => [lat, lng] as [number, number]) };
      }).filter((field) => field.coordinates.length >= 4 && field.acres > 0);
      if (active) { setMapCandidates(fields); setDataStatus(fields.length ? `${fields.length.toLocaleString()} USDA estimated boundaries loaded` : "No USDA boundaries in this map view yet."); }
    }
    void loadUsdaFields(); return () => { active = false; };
  }, [bbox]);
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
    <div className="map-search"><Search size={16}/><input aria-label="Search locations and saved fields" placeholder="Search US city, address, ZIP, coordinates, or saved field" value={search} onChange={e => setSearch(e.target.value)}/>{search && <div className="map-search-results">{data.fields.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) && !!f.boundaryGeoJson).slice(0, 5).map(f => <button key={f.id} onClick={() => { const point = f.boundaryGeoJson!.coordinates[0][0]; setCenter([point[1], point[0]]); setSearch(f.name); setLocations([]); }}>{f.name} · saved field</button>)}{locations.map((place, i) => <button key={`${place.label}-${i}`} onClick={() => { setCenter([place.latitude, place.longitude]); setSearch(place.label); setLocations([]); }}>{place.label}</button>)}</div>}</div>
    <div className="map-layout"><section className="map-panel"><div className="map-toolbar"><span>{drawing ? <><Pencil size={15}/> Click corners around your field</> : <><MousePointer2 size={15}/> Select an estimated USDA boundary or draw your own</>}</span><span className="map-toolbar-actions"><span className="map-data-status">{dataStatus}</span><button className="map-tool-button" onClick={drawing ? finishDrawing : startDrawing}>{drawing ? <><Check size={14}/> Finish boundary</> : <><Pencil size={14}/> Draw my boundary</>}</button>{drawing && <button className="map-tool-button secondary" onClick={() => setDrawing(false)}><Eraser size={14}/> Cancel</button>}</span></div><FarmMapCanvas candidates={mapCandidates} selectedId={selected?.id ?? null} onSelect={selectCandidate} drawing={drawing} onDrawComplete={acceptDrawnBoundary} center={center} onBoundsChange={setBbox}/></section>
      <aside className="map-side"><div className="map-side-card"><div className="map-side-heading"><Info size={16}/><span>How this works</span></div><ol><li>Search any US location or saved field.</li><li>Click an estimated boundary or draw one.</li><li>Confirm the field name and crop to save it.</li></ol><p className="map-disclaimer">{supabase ? "USDA CSB boundaries are algorithmic estimates of crop fields, not property or FSA boundaries. Confirm before using them for operations." : "Demo suggestions are fictional, not property boundaries."}</p></div>
        {selected ? <div className="map-select-card"><div className="map-side-heading"><Check size={16}/><span>Confirm selected area</span></div><div className="map-selection-name">{selected.name}</div><label>Field name<input value={fieldName} onChange={(e) => setFieldName(e.target.value)} /></label><label>Crop<select value={crop} onChange={(e) => setCrop(e.target.value as CandidateField["crop"])}><option value="Corn">Corn</option><option value="Soybeans">Soybeans</option></select></label><div className="map-acreage"><Wheat size={15}/><span>{selected.acres} estimated acres</span></div><button className="primary-button" onClick={confirmBoundary} disabled={busy || !fieldName.trim()}><Save size={15}/>{busy ? "Saving…" : "Confirm and save field"}</button>{saved && <p className="map-saved-message">Saved to your farm records. This boundary now flows into operations and AI context.</p>}</div> : <div className="map-side-card map-empty-side"><MousePointer2 size={20}/><strong>Choose a boundary</strong><p>Click any outlined field to begin.</p></div>}
      </aside></div>
    <section className="map-saved"><div className="section-heading"><div><span className="eyebrow">SAVED FIELDS</span><h2>Confirmed boundaries</h2></div><span className="muted">{savedBoundaries.length} mapped</span></div>{savedBoundaries.length ? <div className="map-saved-list">{savedBoundaries.map((field) => <div className="map-saved-row" key={field.id}><div><strong>{field.name}</strong><span>{field.crop} · {field.acres} acres</span></div><span className="map-confirmed"><Check size={13}/> Confirmed</span></div>)}</div> : <p className="map-empty-copy">No boundaries confirmed yet. The saved fields below will be available to your operations and assistant views.</p>}</section>
  </Shell>;
}
