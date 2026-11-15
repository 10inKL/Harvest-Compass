"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Pencil, Plus, Sprout, Trash2, Warehouse, Wheat } from "lucide-react";
import { Shell } from "@/components/shell";
import { useFarm } from "@/components/farm-provider";
import { newId, type GrainSale } from "@/lib/farm-store";

type Balance = { key: string; crop: GrainSale["crop"]; bin: string; harvested: number; sold: number; remaining: number };
const balanceKey = (crop: string, bin: string) => crop + "::" + bin.trim().toLowerCase();
const money = (amount: number) => amount.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function InventoryPage() {
  const { data, harvestAvailable, salesAvailable, busy, error, saveRecord, deleteRecord } = useFarm();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [soldOn, setSoldOn] = useState("");
  const [bushels, setBushels] = useState("");
  const [price, setPrice] = useState("");
  const [buyer, setBuyer] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const groups = new Map<string, Balance>();
  for (const entry of data.harvestEntries) {
    const field = data.fields.find(item => item.id === entry.fieldId);
    if (!field) continue;
    const key = balanceKey(field.crop, entry.storageBin);
    const previous = groups.get(key);
    groups.set(key, { key, crop: field.crop, bin: previous?.bin ?? entry.storageBin, harvested: (previous?.harvested ?? 0) + entry.bushels, sold: previous?.sold ?? 0, remaining: 0 });
  }
  for (const sale of data.grainSales) {
    const key = balanceKey(sale.crop, sale.storageBin);
    const previous = groups.get(key);
    groups.set(key, { key, crop: sale.crop, bin: previous?.bin ?? sale.storageBin, harvested: previous?.harvested ?? 0, sold: (previous?.sold ?? 0) + sale.bushels, remaining: 0 });
  }
  const rows = [...groups.values()].map(row => ({ ...row, remaining: Math.round((row.harvested - row.sold) * 100) / 100 })).sort((a, b) => a.crop.localeCompare(b.crop) || a.bin.localeCompare(b.bin));
  const harvestTotal = rows.reduce((sum, row) => sum + row.harvested, 0);
  const soldTotal = rows.reduce((sum, row) => sum + row.sold, 0);
  const revenue = data.grainSales.reduce((sum, sale) => sum + sale.bushels * sale.pricePerBushel, 0);
  const selected = rows.find(row => row.key === selectedKey);
  const original = data.grainSales.find(sale => sale.id === editingId);
  const available = (selected?.remaining ?? 0) + (original && balanceKey(original.crop, original.storageBin) === selectedKey ? original.bushels : 0);
  const positiveRows = rows.filter(row => row.remaining > 0 || (original && row.key === balanceKey(original.crop, original.storageBin)));

  function startAdd() {
    setEditingId(null); setSelectedKey(positiveRows[0]?.key ?? ""); setSoldOn(new Date().toISOString().slice(0, 10));
    setBushels(""); setPrice(""); setBuyer(""); setNotes(""); setFormError(""); setOpen(true);
  }
  function startEdit(sale: GrainSale) {
    setEditingId(sale.id); setSelectedKey(balanceKey(sale.crop, sale.storageBin)); setSoldOn(sale.soldOn);
    setBushels(String(sale.bushels)); setPrice(String(sale.pricePerBushel)); setBuyer(sale.buyer); setNotes(sale.notes); setFormError(""); setOpen(true);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const quantity = Number(bushels);
    const unitPrice = Number(price);
    if (!selected || !Number.isFinite(quantity) || quantity <= 0 || quantity > available + 0.001) { setFormError("Enter bushels no greater than the available balance in this bin."); return; }
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || !soldOn) { setFormError("Enter a valid sale date and price."); return; }
    const sale: GrainSale = { id: editingId ?? newId(), crop: selected.crop, storageBin: selected.bin, soldOn, bushels: quantity, pricePerBushel: unitPrice, buyer: buyer.trim(), notes: notes.trim() };
    if (await saveRecord("grainSales", sale)) { setOpen(false); setEditingId(null); setFormError(""); }
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this grain sale record? The bushels will return to the available balance.")) return;
    await deleteRecord("grainSales", id);
  }
  if (!harvestAvailable) return <Shell><div className="section-empty">Harvest logging is being set up in Supabase. Please refresh after the database migration is applied.</div></Shell>;
  return <Shell>
    <div className="demo-label">{data.demoSeeded ? "DEMO-SEED WORKSPACE · REVIEW RECORDS BEFORE USE" : "SAVED GRAIN INVENTORY"}</div>
    <section className="section-hero"><div className="section-icon"><Warehouse size={30}/></div><div><span className="eyebrow">AFTER HARVEST</span><h2>Know what is in storage</h2><p>Harvest entries add grain. Saved sales deduct grain and appear in season reports.</p></div></section>
    <section className="harvest-stats" aria-label="Inventory totals">
      <div className="kpi"><span className="kpi-icon gold"><Wheat size={21}/></span><span className="kpi-label">Harvested</span><strong>{harvestTotal.toLocaleString()} <small>bu</small></strong></div>
      <div className="kpi"><span className="kpi-icon green"><Sprout size={21}/></span><span className="kpi-label">Available balance</span><strong>{(harvestTotal - soldTotal).toLocaleString()} <small>bu</small></strong></div>
      <div className="kpi"><span className="kpi-icon blue"><Warehouse size={21}/></span><span className="kpi-label">Sales revenue</span><strong>{money(revenue)}</strong></div>
    </section>
    <section className="records-panel"><div className="records-head"><div><h3>Grain by storage location</h3><p>Calculated from saved harvest and sale entries</p></div><Link className="text-link" href="/harvest">Harvest log <ArrowRight size={15}/></Link></div>{rows.length === 0 ? <p className="section-empty">No grain recorded yet. Add a harvest entry to start inventory.</p> : <div className="inventory-table"><div className="inventory-head inventory-five"><span>Crop</span><span>Storage bin</span><span>Harvested</span><span>Sold</span><span>Available</span></div>{rows.map(row => <div className="inventory-row inventory-five" key={row.key}><strong>{row.crop}</strong><span>{row.bin}</span><span>{row.harvested.toLocaleString()} bu</span><span>{row.sold.toLocaleString()} bu</span><strong className={row.remaining < 0 ? "balance-negative" : ""}>{row.remaining.toLocaleString()} bu</strong></div>)}</div>}</section>
    <section className="records-panel"><div className="records-head"><div><h3>Grain sales</h3><p>{data.grainSales.length} saved sales · {soldTotal.toLocaleString()} bu sold</p></div>{salesAvailable && <button className="primary-button" onClick={startAdd} disabled={busy || positiveRows.length === 0}><Plus size={16}/> Record sale</button>}</div>
      {!salesAvailable && <p className="section-empty">Grain sales are being set up in Supabase. Refresh after the migration is applied.</p>}
      {salesAvailable && positiveRows.length === 0 && <p className="section-empty">Record harvested grain before adding a sale.</p>}
      {open && <form className="record-form" onSubmit={submit}><div className="form-title">{editingId ? "Edit grain sale" : "New grain sale"}</div>
        <label>Crop and storage bin<select required value={selectedKey} onChange={event => setSelectedKey(event.target.value)}>{positiveRows.map(row => <option key={row.key} value={row.key}>{row.crop} · {row.bin} · {row.remaining.toLocaleString()} bu available</option>)}</select></label>
        <label>Sale date<input required type="date" value={soldOn} onChange={event => setSoldOn(event.target.value)}/></label>
        <label>Bushels sold<input required type="number" min="0.01" max={available} step="0.01" value={bushels} onChange={event => setBushels(event.target.value)}/></label>
        <label>Price per bushel ($)<input required type="number" min="0" step="0.01" value={price} onChange={event => setPrice(event.target.value)}/></label>
        <label>Buyer (optional)<input value={buyer} onChange={event => setBuyer(event.target.value)} placeholder="Elevator or buyer"/></label>
        <label>Notes (optional)<input value={notes} onChange={event => setNotes(event.target.value)}/></label>
        {formError && <p className="record-error" role="alert">{formError}</p>}<div className="form-actions"><button type="button" className="quiet-button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save sale"}</button></div>
      </form>}
      {error && <p className="record-error" role="alert">{error}</p>}
      {data.grainSales.length > 0 && <div className="records-list">{[...data.grainSales].sort((a, b) => b.soldOn.localeCompare(a.soldOn)).map(sale => <div className="record-row" key={sale.id}><div className="record-main"><strong>{sale.crop} · {sale.bushels.toLocaleString()} bu · {money(sale.bushels * sale.pricePerBushel)}</strong><span>{sale.soldOn} · {sale.storageBin} · {money(sale.pricePerBushel)}/bu{sale.buyer ? " · " + sale.buyer : ""}</span>{sale.notes && <span>{sale.notes}</span>}</div><div className="record-actions"><button className="quiet-button" onClick={() => startEdit(sale)} disabled={busy}><Pencil size={14}/> Edit</button><button className="delete-button" aria-label="Delete grain sale" onClick={() => remove(sale.id)} disabled={busy}><Trash2 size={16}/></button></div></div>)}</div>}
    </section>
    <div className="section-note"><span>Available balance is harvested bushels minus recorded sales. Transfers and shrink are not tracked yet.</span><Link href="/reports">Season report <ArrowRight size={15}/></Link></div>
  </Shell>;
}
