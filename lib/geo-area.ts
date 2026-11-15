import type { BoundaryGeometry } from "@/lib/map-data";

// Spherical area of the full polygon, including islands and holes. The exact
// hosted acreage uses PostGIS geography; this covers the local SQLite fallback.
export function geometryAcres(geometry: BoundaryGeometry): number {
  const polygons = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
  const radians = Math.PI / 180;
  const radiusMeters = 6371008.8;
  const ringArea = (ring: number[][]) => {
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i += 1) {
      const [lng1, lat1] = ring[i];
      const [lng2, lat2] = ring[i + 1];
      sum += (lng2 - lng1) * radians * (Math.sin(lat1 * radians) + Math.sin(lat2 * radians));
    }
    return Math.abs(sum * radiusMeters * radiusMeters / 2);
  };
  const squareMeters = polygons.reduce((total, polygon) => {
    if (!polygon.length) return total;
    return total + Math.max(0, ringArea(polygon[0]) - polygon.slice(1).reduce((holes, ring) => holes + ringArea(ring), 0));
  }, 0);
  return Math.round(squareMeters / 4046.8564224 * 100) / 100;
}
