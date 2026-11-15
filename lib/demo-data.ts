import type { BoundaryGeometry } from "@/lib/map-data";
export interface Field { id: string; name: string; crop: "Corn" | "Soybeans"; acres: number; planted: string; status: string; progress: number; boundaryGeoJson?: BoundaryGeometry; boundarySource?: string; boundaryConfirmed?: boolean; }
export interface Farm { name: string; location: string; season: string; totalAcres: number; estimatedExpenses: number; fields: Field[]; }
export const farm: Farm = { name: "Prairie Creek Farm", location: "Brookings County, South Dakota", season: "2026 Season", totalAcres: 1280, estimatedExpenses: 428500, fields: [
  { id: "north", name: "North Quarter", crop: "Corn", acres: 320, planted: "May 8", status: "On track", progress: 78 },
  { id: "creek", name: "Creek Bottom", crop: "Soybeans", acres: 240, planted: "May 18", status: "Needs attention", progress: 62 },
  { id: "east", name: "East Ridge", crop: "Corn", acres: 400, planted: "May 11", status: "On track", progress: 83 },
  { id: "south", name: "South Flats", crop: "Soybeans", acres: 320, planted: "May 20", status: "On track", progress: 71 },
]};
export const expenses = [
  { name: "Seed", value: 112000, color: "#275f45" }, { name: "Fertilizer", value: 137500, color: "#8bab72" },
  { name: "Fuel & equipment", value: 96000, color: "#d8ad65" }, { name: "Labor & other", value: 83000, color: "#abc9c0" },
];
export const tasks = [
  { title: "Scout Creek Bottom for moisture stress", detail: "Creek Bottom · Soybeans", date: "Aug 18", priority: "High" },
  { title: "Service combine before harvest window", detail: "Equipment · John Deere S780", date: "Aug 21", priority: "Medium" },
  { title: "Review grain storage capacity", detail: "Storage · Main bins", date: "Aug 24", priority: "Medium" },
];
export const activity = [
  { title: "Field scouting notes updated", detail: "North Quarter · 2 hours ago" },
  { title: "Fuel expense recorded", detail: "$1,240 · Yesterday" },
  { title: "Planting record completed", detail: "South Flats · Aug 14" },
];
