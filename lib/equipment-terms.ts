export type EquipmentTerms = { access: string; provider: string; rate: string; unit: string; quantity: string; inclusions: string };
export const emptyTerms: EquipmentTerms = { access: "Unknown", provider: "", rate: "", unit: "hour", quantity: "", inclusions: "" };
const marker = "\n\nEquipment agreement:\n";
export function equipmentEstimate(terms: EquipmentTerms): number | null {
  if (!terms.rate || !terms.quantity) return null;
  const rate = Number(terms.rate), quantity = Number(terms.quantity);
  return Number.isFinite(rate) && Number.isFinite(quantity) && rate >= 0 && quantity > 0 ? Math.round(rate * quantity * 100) / 100 : null;
}
export function readEquipmentTerms(note: string) {
  const index = note.indexOf(marker);
  if (index < 0) return { note, terms: { ...emptyTerms } };
  try { const terms = JSON.parse(note.slice(index + marker.length)) as Partial<EquipmentTerms>; return { note: note.slice(0, index), terms: { ...emptyTerms, ...terms } }; }
  catch { return { note, terms: { ...emptyTerms } }; }
}
export function writeEquipmentTerms(note: string, terms: EquipmentTerms) { return note.trim() + marker + JSON.stringify(terms); }
export function equipmentDescription(note: string) {
  const parsed = readEquipmentTerms(note), estimate = equipmentEstimate(parsed.terms);
  return [parsed.note, parsed.terms.access !== "Unknown" ? parsed.terms.access : "", parsed.terms.provider, estimate === null ? "" : `Estimated agreement cost: $${estimate.toLocaleString()} (${parsed.terms.quantity} ${parsed.terms.unit} × $${parsed.terms.rate}); not a logged expense`, parsed.terms.inclusions].filter(Boolean).join(" · ");
}
