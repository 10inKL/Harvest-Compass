export type BoundaryGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };
export type CandidateField = { id: string; name: string; crop: "Corn" | "Soybeans" | "Unassigned"; acres: number; source: string; coordinates: [number, number][]; geometry?: BoundaryGeometry };
