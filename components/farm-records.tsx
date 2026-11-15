"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { emptyTerms, readEquipmentTerms, writeEquipmentTerms, equipmentDescription } from "@/lib/equipment-terms";
import { EquipmentAgreementFields } from "./equipment-agreement-fields";
import { Plus, Trash2, Check, RotateCcw, Pencil } from "lucide-react";
import { useFarm } from "./farm-provider";
import { newId, type Expense, type FarmTask, type Equipment } from "@/lib/farm-store";
import type { Field } from "@/lib/demo-data";
type Kind = "fields" | "tasks" | "expenses" | "equipment";
const labels: Record<Kind,string> = { fields:"Field", tasks:"Task", expenses:"Expense", equipment:"Equipment" };
export function FarmRecords({ kind }: { kind: Kind }) {
  const router = useRouter();
  const { data, saveRecord, deleteRecord, busy, error } = useFarm();
  const [adding,setAdding] = useState(false);
  const [editingId,setEditingId] = useState<string|null>(null);
  const [form,setForm] = useState<Record<string,string>>({});
  const draftId=useRef<string|null>(null);
  const [formError,setFormError]=useState("");
  const [saving,setSaving]=useState(false);
  function update(key:string, value:string) { setForm(prev => ({...prev,[key]:value})); }
  function startAdd(){if(kind==="fields"){router.push("/farm-map");return;}draftId.current=newId();setFormError("");setForm({...emptyTerms});setEditingId(null);setAdding(true);}
  function startEdit(item:Field|FarmTask|Expense|Equipment){
    draftId.current=item.id;setFormError("");setEditingId(item.id);setAdding(true);
    if(kind==="fields"){const f=item as Field;setForm({name:f.name,crop:f.crop,acres:String(f.acres),planted:f.planted.match(/^\d{4}-/) ? f.planted : "",status:f.status,progress:String(f.progress)});}
    if(kind==="tasks"){const t=item as FarmTask;setForm({title:t.title,detail:t.detail,due:t.due.match(/^\d{4}-/) ? t.due : "",priority:t.priority});}
    if(kind==="expenses"){const e=item as Expense;setForm({category:e.category,amount:String(e.amount),date:e.date,note:e.note});}
    if(kind==="equipment"){const e=item as Equipment;const parsed=readEquipmentTerms(e.note);const linked=data.expenses.find(expense=>expense.id===(parsed.terms.expenseId||e.id));setForm({name:e.name,status:e.status,note:parsed.note,...parsed.terms,costMode:linked?"existing":"planned",expenseId:linked?.id||parsed.terms.expenseId,actualAmount:linked?String(linked.amount):"",actualDate:linked?.date||""});}
  }
  async function remove(id:string) { if (!window.confirm(`Delete this ${labels[kind].toLowerCase()} record?`)) return; await deleteRecord(kind,id); }
  async function submit(event:FormEvent) { event.preventDefault();if(saving||busy)return;setFormError("");const id = editingId??draftId.current??newId();draftId.current=id; let item:Field|FarmTask|Expense|Equipment;
    if(kind === "fields") { const previous=data.fields.find(f=>f.id===id); item={id,name:form.name.trim(),crop:form.crop as Field["crop"],acres:Number(form.acres),planted:form.planted||"Not set",status:form.status||previous?.status||"Planned",progress:(form.status||previous?.status||"Planned")==="Planned"?0:form.progress===""||form.progress===undefined?(previous?.progress??0):Number(form.progress),boundaryGeoJson:previous?.boundaryGeoJson,boundarySource:previous?.boundarySource,boundaryConfirmed:previous?.boundaryConfirmed}; if(!item.name||item.acres<=0||item.progress<0||item.progress>100)return; }
    else if(kind === "tasks") { const previous=data.tasks.find(t=>t.id===id); item={id,title:form.title.trim(),detail:form.detail.trim(),due:form.due,priority:form.priority as FarmTask["priority"],done:previous?.done??false}; if(!item.title||!item.due)return; }
    else if(kind === "expenses") { item={id,category:form.category as Expense["category"],amount:Number(form.amount),date:form.date,note:form.note.trim()}; if(item.amount<=0||!item.date)return; }
    else {
      const mode=form.costMode||"planned";
      if(mode==="existing"&&!data.expenses.some(expense=>expense.id===form.expenseId)){setFormError("Choose the expense you already recorded.");return;}
      const linked=readEquipmentTerms(data.equipment.find(e=>e.id===id)?.note||"").terms.expenseId;
      if(mode==="planned"&&data.expenses.some(expense=>expense.id===(linked||id))){setFormError("This equipment already has an expense. Keep it linked; edit or remove the bill in Reports first.");return;}
      if(mode==="record"&&linked&&linked!==id){setFormError("This equipment is already linked to a bill. Update that expense in Reports instead of creating a duplicate.");return;}
      if(mode==="record"&&(!Number.isFinite(Number(form.actualAmount))||Number(form.actualAmount)<=0||!/^\d{4}-\d{2}-\d{2}$/.test(form.actualDate||""))){setFormError("Enter the actual bill amount and date.");return;}
      item={id,name:form.name.trim(),status:form.status as Equipment["status"],note:writeEquipmentTerms(form.note??"",{...emptyTerms,access:form.access||"Unknown",provider:form.provider||"",rate:form.rate||"",unit:form.unit||"hour",quantity:form.unit==="fixed agreement"?"1":form.quantity||"",inclusions:form.inclusions||"",expenseId:mode==="record"?id:mode==="existing"?form.expenseId:""})};if(!item.name)return;
    }
    setSaving(true);
    try{
      if(kind==="equipment"&&form.costMode==="record"){
        const expense:Expense={id,category:"Fuel & equipment",amount:Number(form.actualAmount),date:form.actualDate,note:form.name.trim()+" - actual equipment cost"+(form.provider?" · "+form.provider:"")};
        if(!await saveRecord("expenses",expense)){setFormError("The actual expense could not be saved. Nothing was added to equipment; please retry.");return;}
      }
      if(await saveRecord(kind,item)){setAdding(false);setEditingId(null);draftId.current=null;setForm({});}
      else if(kind==="equipment"&&form.costMode==="record")setFormError("The bill is saved, but equipment details could not be updated. Retry Save; the same expense will be updated, not added twice.");
    }finally{setSaving(false);}
  }
  async function toggleTask(id:string) { const task=data.tasks.find(t=>t.id===id);if(task)await saveRecord("tasks",{...task,done:!task.done}); }
  async function changeEquipment(id:string,status:Equipment["status"]) { const equipment=data.equipment.find(e=>e.id===id);if(equipment)await saveRecord("equipment",{...equipment,status}); }
  return <section className="records-panel"><div className="records-head"><div><h3>{labels[kind]} records</h3><p>{data[kind].length} saved {data[kind].length === 1 ? "record" : "records"}</p></div><button className="primary-button" onClick={startAdd} disabled={busy}><Plus size={16}/> Add {labels[kind].toLowerCase()}</button></div>
  {adding && <form className="record-form" onSubmit={submit}><div className="form-title">{editingId ? `Edit ${labels[kind].toLowerCase()}` : `New ${labels[kind].toLowerCase()}`}</div>
    {kind==="fields" && <><label>Field name<input required value={form.name??""} onChange={e=>update("name",e.target.value)} placeholder="West Ridge"/></label><label>Crop<select required value={form.crop??""} onChange={e=>update("crop",e.target.value)}><option value="">Select crop</option><option>Corn</option><option>Soybeans</option></select></label><label>Acres<input required type="number" min="0.01" step="0.01" value={form.acres??""} onChange={e=>update("acres",e.target.value)}/></label><label>{(form.status??"Planned")==="Planned"?"Planned planting date (optional)":"Actual planting date (optional)"}<input type="date" value={form.planted??""} onChange={e=>update("planted",e.target.value)}/></label><label>Status<select value={form.status??"Planned"} onChange={e=>{update("status",e.target.value);if(e.target.value==="Planned")update("progress","0");}}><option value="Planned">Planned / Not planted yet</option><option>On track</option><option>Needs attention</option><option>Harvested</option></select></label><label>Season progress (%) — planned fields stay at 0<input required type="number" min="0" max="100" disabled={(form.status??"Planned")==="Planned"} value={(form.status??"Planned")==="Planned"?"0":form.progress??"0"} onChange={e=>update("progress",e.target.value)}/></label></>}
    {kind==="tasks" && <><label>Task<input required value={form.title??""} onChange={e=>update("title",e.target.value)} placeholder="Scout North Quarter"/></label><label>Details<input value={form.detail??""} onChange={e=>update("detail",e.target.value)}/></label><label>Due date<input required type="date" value={form.due??""} onChange={e=>update("due",e.target.value)}/></label><label>Priority<select required value={form.priority??""} onChange={e=>update("priority",e.target.value)}><option value="">Select priority</option><option>High</option><option>Medium</option><option>Low</option></select></label></>}
    {kind==="expenses" && <><label>Category<select required value={form.category??""} onChange={e=>update("category",e.target.value)}><option value="">Select category</option><option>Seed</option><option>Fertilizer</option><option>Fuel & equipment</option><option>Labor & other</option></select></label><label>Amount ($)<input required type="number" min="0.01" step="0.01" value={form.amount??""} onChange={e=>update("amount",e.target.value)}/></label><label>Date<input required type="date" value={form.date??""} onChange={e=>update("date",e.target.value)}/></label><label>Note<input value={form.note??""} onChange={e=>update("note",e.target.value)}/></label></>}
    {kind==="equipment" && <><label>Equipment name<input required value={form.name??""} onChange={e=>update("name",e.target.value)} placeholder="Grain cart"/></label><label>Status<select required value={form.status??""} onChange={e=>update("status",e.target.value)}><option value="">Select status</option><option>Ready</option><option>Needs service</option><option>In use</option></select></label><EquipmentAgreementFields form={form} update={update}/><label>Note<input value={form.note??""} onChange={e=>update("note",e.target.value)}/></label></>}
    {formError&&<p className="record-error" style={{gridColumn:"1 / -1"}} role="alert">{formError}</p>}
    <div className="form-actions"><button type="button" className="quiet-button" disabled={saving||busy} onClick={()=>setAdding(false)}>Cancel</button><button className="primary-button" type="submit" disabled={busy||saving}>{busy||saving ? "Saving…" : kind==="equipment"&&form.costMode==="record"?"Save equipment & record expense":`Save ${labels[kind].toLowerCase()}`}</button></div>
  </form>}
  {error && <p className="record-error" role="alert">{error}</p>}<div className="records-list">{data[kind].map(item=><div className="record-row" key={item.id}><div className="record-main">{kind==="fields" && <><strong>{(item as Field).name}</strong><span>{(item as Field).crop} · {(item as Field).acres} acres · {(item as Field).status==="Planned"?"Planting planned":"Planted"} {(item as Field).planted}</span></>}{kind==="tasks" && <><strong>{(item as FarmTask).title}</strong><span>{(item as FarmTask).detail} · Due {(item as FarmTask).due} · {(item as FarmTask).priority} priority</span></>}{kind==="expenses" && <><strong>{(item as Expense).category} · ${(item as Expense).amount.toLocaleString()}</strong><span>{(item as Expense).date} · {(item as Expense).note}</span></>}{kind==="equipment" && <><strong>{(item as Equipment).name}</strong><span>{equipmentDescription((item as Equipment).note,data.expenses,(item as Equipment).id)}</span></>}</div><div className="record-actions"><button className="quiet-button" onClick={()=>startEdit(item)} disabled={busy}><Pencil size={14}/> Edit</button>{kind==="tasks" && <button className="quiet-button" onClick={()=>toggleTask(item.id)} disabled={busy}>{(item as FarmTask).done?<><RotateCcw size={14}/> Reopen</>:<><Check size={14}/> Complete</>}</button>}{kind==="equipment" && <select aria-label={`Status for ${(item as Equipment).name}`} value={(item as Equipment).status} onChange={e=>changeEquipment(item.id,e.target.value as Equipment["status"])} disabled={busy}><option>Ready</option><option>Needs service</option><option>In use</option></select>}<button className="delete-button" aria-label={`Delete ${labels[kind].toLowerCase()}`} onClick={()=>remove(item.id)} disabled={busy}><Trash2 size={16}/></button></div></div>)}</div>
  </section>;
}
