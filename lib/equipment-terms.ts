export type EquipmentTerms = { access: string; provider: string; rate: string; unit: string; quantity: string; inclusions: string; expenseId: string };
export const emptyTerms: EquipmentTerms = { access: "Unknown", provider: "", rate: "", unit: "hour", quantity: "", inclusions: "", expenseId: "" };
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
export function equipmentDescription(note: string, expenses?: { id: string; amount: number; date?: string; incurred_on?: string }[], equipmentId?: string) {
  const parsed = readEquipmentTerms(note), estimate = equipmentEstimate(parsed.terms);
  const linkedId=parsed.terms.expenseId||equipmentId;
  const actual=expenses?.find(expense=>expense.id===linkedId);
  const cost=actual?`Recorded expense: $${Number(actual.amount).toLocaleString()} on ${actual.date||actual.incurred_on||"date not entered"}; included once in expense totals`:parsed.terms.expenseId?"Linked expense is unavailable; review the expense ledger":estimate===null?"":`Planning estimate: $${estimate.toLocaleString()} (${parsed.terms.quantity} ${parsed.terms.unit} × $${parsed.terms.rate}); not included in expense totals`;
  return [parsed.note, parsed.terms.access !== "Unknown" ? parsed.terms.access : "", parsed.terms.provider, cost, parsed.terms.inclusions].filter(Boolean).join(" · ");
}
