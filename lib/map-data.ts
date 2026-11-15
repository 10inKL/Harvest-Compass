export type CandidateField = { id: string; name: string; crop: "Corn" | "Soybeans"; acres: number; source: string; coordinates: [number, number][] };
// Demo candidate polygons for the Brookings County view. They are suggestions, not legal boundaries.
export const candidateFields: CandidateField[] = [
  { id: "candidate-north", name: "North Quarter candidate", crop: "Corn", acres: 320, source: "Demo suggested agricultural boundary", coordinates: [[44.292,-96.805],[44.292,-96.772],[44.281,-96.772],[44.281,-96.805],[44.292,-96.805]] },
  { id: "candidate-east", name: "East Ridge candidate", crop: "Corn", acres: 400, source: "Demo suggested agricultural boundary", coordinates: [[44.292,-96.768],[44.292,-96.732],[44.279,-96.732],[44.279,-96.768],[44.292,-96.768]] },
  { id: "candidate-creek", name: "Creek Bottom candidate", crop: "Soybeans", acres: 240, source: "Demo suggested agricultural boundary", coordinates: [[44.277,-96.805],[44.277,-96.776],[44.265,-96.776],[44.265,-96.805],[44.277,-96.805]] },
  { id: "candidate-south", name: "South Flats candidate", crop: "Soybeans", acres: 320, source: "Demo suggested agricultural boundary", coordinates: [[44.262,-96.768],[44.262,-96.728],[44.248,-96.728],[44.248,-96.768],[44.262,-96.768]] },
];
