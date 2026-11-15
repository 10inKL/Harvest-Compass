"use client";
/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup, Polygon } from "leaflet";
import type { CandidateField } from "@/lib/map-data";

export function FarmMapCanvas({ candidates, selectedId, onSelect, drawing, onDrawComplete, center, onBoundsChange }: { candidates: CandidateField[]; selectedId: string | null; onSelect: (candidate: CandidateField) => void; drawing: boolean; onDrawComplete: (coordinates: [number, number][]) => void; center: [number, number] | null; onBoundsChange: (bbox: [number, number, number, number]) => void }) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layers = useRef<LayerGroup | null>(null);
  const drawPoints = useRef<[number, number][]>([]);
  const drawLayer = useRef<Polygon | null>(null);
  const drawingRef = useRef(drawing);
  const boundsCallback = useRef(onBoundsChange);
  useEffect(() => { boundsCallback.current = onBoundsChange; }, [onBoundsChange]);
  useEffect(() => { drawingRef.current = drawing; }, [drawing]);
  const renderPolygons = useCallback((L: typeof import("leaflet")) => {
    if (!layers.current) return;
    layers.current.clearLayers();
    for (const candidate of candidates) {
      const polygon = L.polygon(candidate.coordinates.map(([lat, lng]) => [lat, lng] as [number, number]), { color: selectedId === candidate.id ? "#f7d37b" : "#ffffff", weight: selectedId === candidate.id ? 4 : 2, fillColor: candidate.crop === "Corn" ? "#d8b85b" : "#78a87b", fillOpacity: selectedId === candidate.id ? .58 : .32 });
      polygon.bindTooltip(`${candidate.name} · ${candidate.acres} ac`, { sticky: true });
      polygon.on("click", () => onSelect(candidate));
      polygon.addTo(layers.current);
    }
  }, [candidates, selectedId, onSelect]);
  useEffect(() => {
    let active = true;
    void import("leaflet").then(L => {
      if (!active || !node.current || map.current) return;
      const instance = L.map(node.current).setView([44.28, -96.78], 13);
      const imagery = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "Imagery © Esri" });
      const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" });
      imagery.addTo(instance);
      L.control.layers({ "Satellite imagery": imagery, Streets: streets }, undefined, { position: "topright" }).addTo(instance);
      map.current = instance;
      layers.current = L.layerGroup().addTo(instance);
      const emitBounds = () => { const b = instance.getBounds(); boundsCallback.current([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]); };
      instance.on("moveend", emitBounds);
      emitBounds();
      renderPolygons(L);
      instance.on("click", (event) => {
        if (!drawingRef.current) return;
        drawPoints.current = [...drawPoints.current, [event.latlng.lat, event.latlng.lng]];
        drawLayer.current?.remove();
        drawLayer.current = L.polygon(drawPoints.current, { color: "#f7d37b", weight: 3, fillColor: "#f7d37b", fillOpacity: .28 }).addTo(instance);
      });
      setTimeout(() => instance.invalidateSize(), 100);
    });
    return () => { active = false; map.current?.remove(); map.current = null; layers.current = null; };
  }, []);
  useEffect(() => {
    if (!drawing) { drawPoints.current = []; drawLayer.current?.remove(); drawLayer.current = null; }
  }, [drawing]);
  useEffect(() => { if (map.current) void import("leaflet").then(L => renderPolygons(L)); }, [renderPolygons]);
  useEffect(() => { if (center && map.current) map.current.setView(center, 13); }, [center]);
  function finishDrawing() {
    if (drawPoints.current.length < 3) return;
    const points = [...drawPoints.current, drawPoints.current[0]];
    onDrawComplete(points);
  }
  // Expose a small imperative finish hook through the map container custom event.
  useEffect(() => { const handler = () => finishDrawing(); window.addEventListener("harvestcompass:finish-drawing", handler); return () => window.removeEventListener("harvestcompass:finish-drawing", handler); });
  return <div ref={node} className="farm-map-canvas" aria-label="Interactive suggested field boundary map"/>;
}
