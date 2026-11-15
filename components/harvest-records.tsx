"use client";
import { useState, type FormEvent } from "react";
import { CalendarDays, Pencil, Plus, Trash2, Wheat } from "lucide-react";
import { useFarm } from "./farm-provider";
import { newId, type HarvestEntry } from "@/lib/farm-store";
export function HarvestRecords(){
  const {data,saveRecord,deleteRecord,busy,error}=useFarm();
  const entries=data.harvestEntries??[];
  const [editing,setEditing]=useState<string|null>(null);
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState({fieldId:"",harvestedOn:"",bushels:"",moisturePercent:"",storageBin:"Main bin",notes:""});
  function startNew(){const now=new Date();const localDate=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);setEditing(null);setForm({fieldId:"",harvestedOn:localDate,bushels:"",moisturePercent:"",storageBin:"Main bin",notes:""});setOpen(true);}
  function startEdit(entry:HarvestEntry){setEditing(entry.id);setForm({fieldId:entry.fieldId,harvestedOn:entry.harvestedOn,bushels:String(entry.bushels),moisturePercent:entry.moisturePercent===null?"":String(entry.moisturePercent),storageBin:entry.storageBin,notes:entry.notes});setOpen(true);}
  function update(key:keyof typeof form,value:string){setForm(previous=>({...previous,[key]:value}));}
  async function submit(event:FormEvent){event.preventDefault();const bushels=Number(form.bushels);const moisture=form.moisturePercent===""?null:Number(form.moisturePercent);if(!data.fields.some(field=>field.id===form.fieldId)||!form.harvestedOn||!Number.isFinite(bushels)||bushels<=0||moisture!==null&&(!Number.isFinite(moisture)||moisture<0||moisture>100)||!form.storageBin.trim())return;
    const entry:HarvestEntry={id:editing??newId(),fieldId:form.fieldId,harvestedOn:form.harvestedOn,bushels,moisturePercent:moisture,storageBin:form.storageBin.trim(),notes:form.notes.trim()};
    if(await saveRecord("harvestEntries",entry)){setOpen(false);setEditing(null);}
  }
  async function remove(id:string){if(window.confirm("Delete this harvest entry? Its bushels will be removed from inventory."))await deleteRecord("harvestEntries",id);}
  const sorted=[...entries].sort((a,b)=>b.harvestedOn.localeCompare(a.harvestedOn));
  return <section className="records-panel"><div className="records-head"><div><h3>Harvest log</h3><p>{entries.length} saved {entries.length===1?"entry":"entries"} · inventory updates from this log</p></div><button className="primary-button" onClick={startNew} disabled={busy||data.fields.length===0}><Plus size={16}/> Record harvest</button></div>
    {open&&<form className="record-form" onSubmit={submit}><div className="form-title">{editing?"Edit harvest entry":"Record a harvest"}</div>
      <label>Field<select required value={form.fieldId} onChange={e=>update("fieldId",e.target.value)}><option value="">Select a field</option>{data.fields.map(field=><option key={field.id} value={field.id}>{field.name} · {field.crop}</option>)}</select></label>
      <label>Harvest date<input required type="date" value={form.harvestedOn} onChange={e=>update("harvestedOn",e.target.value)}/></label>
      <label>Bushels harvested<input required type="number" min="0.01" step="0.01" value={form.bushels} onChange={e=>update("bushels",e.target.value)}/></label>
      <label>Moisture (%) <span className="optional">optional</span><input type="number" min="0" max="100" step="0.01" value={form.moisturePercent} onChange={e=>update("moisturePercent",e.target.value)}/></label>
      <label>Storage bin<input required maxLength={80} value={form.storageBin} onChange={e=>update("storageBin",e.target.value)} placeholder="Main bin"/></label>
      <label>Notes <span className="optional">optional</span><input maxLength={240} value={form.notes} onChange={e=>update("notes",e.target.value)} placeholder="Harvest conditions"/></label>
      <div className="form-actions"><button type="button" className="quiet-button" onClick={()=>setOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={busy}>{busy?"Saving…":"Save harvest entry"}</button></div>
    </form>}
    {error&&<p className="record-error" role="alert">{error}</p>}
    {data.fields.length===0&&<p className="section-empty">Add a field on the Farm Map page before recording harvest.</p>}
    {sorted.length===0?<p className="section-empty">No harvest entries yet. Record a field harvest to start your inventory.</p>:<div className="records-list">{sorted.map(entry=>{const field=data.fields.find(item=>item.id===entry.fieldId);return <div className="record-row" key={entry.id}><div className="record-main"><strong><Wheat size={15}/> {field?.name??"Deleted field"} · {entry.bushels.toLocaleString()} bu</strong><span><CalendarDays size={13}/> {entry.harvestedOn} · {field?.crop??"Unknown crop"} · {entry.storageBin}{entry.moisturePercent!==null?` · ${entry.moisturePercent}% moisture`:""}</span>{entry.notes&&<span>{entry.notes}</span>}</div><div className="record-actions"><button className="quiet-button" onClick={()=>startEdit(entry)} disabled={busy}><Pencil size={14}/> Edit</button><button className="delete-button" aria-label="Delete harvest entry" onClick={()=>remove(entry.id)} disabled={busy}><Trash2 size={16}/></button></div></div>;})}</div>}
  </section>;
}
