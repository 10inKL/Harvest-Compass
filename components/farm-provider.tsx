"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { initialFarmState, newId, type FarmState } from "@/lib/farm-store";
import { supabase } from "@/lib/supabase-client";
const STORAGE_KEY = "harvestcompass-farm-v1";
type RecordKind = keyof typeof tables;
type FarmRecord = FarmState["fields"][number] | FarmState["tasks"][number] | FarmState["expenses"][number] | FarmState["equipment"][number] | FarmState["harvestEntries"][number] | FarmState["grainSales"][number];
type FarmProfile = { name: string; location: string; seasonYear: number };
type Workspace = { id: string; name: string; demoSeeded: boolean };
type FarmContext = { data: FarmState; farmId: string | null; workspaces: Workspace[]; ready: boolean; hosted: boolean; harvestAvailable: boolean; salesAvailable: boolean; user: User | null; busy: boolean; error: string; saveRecord: (kind: RecordKind, record: FarmRecord) => Promise<boolean>; deleteRecord: (kind: RecordKind, id: string) => Promise<boolean>; saveFarmProfile: (profile: FarmProfile) => Promise<boolean>; createFarm: (profile: FarmProfile) => Promise<boolean>; switchFarm: (id: string) => Promise<boolean>; refreshFarm: () => Promise<void>; signOut: () => Promise<void> };
const Context = createContext<FarmContext | null>(null);
const tables = { fields: "fields", tasks: "farm_tasks", expenses: "expenses", equipment: "equipment", harvestEntries: "harvest_entries", grainSales: "grain_sales" } as const;
function demoDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(`${value}, 2026`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0,10);
}
function toRow(kind: keyof typeof tables, item: FarmState[typeof kind][number], farmId: string) {
  if (kind === "fields") { const f=item as FarmState["fields"][number]; return {id:f.id,farm_id:farmId,name:f.name,crop:f.crop,acres:f.acres,planted_on:demoDate(f.planted),status:f.status,progress:f.progress,boundary_geojson:f.boundaryGeoJson??null,boundary_source:f.boundarySource??null,boundary_confirmed:f.boundaryConfirmed??false}; }
  if (kind === "tasks") { const t=item as FarmState["tasks"][number]; return {id:t.id,farm_id:farmId,title:t.title,detail:t.detail,due_on:demoDate(t.due),priority:t.priority,done:t.done}; }
  if (kind === "expenses") { const e=item as FarmState["expenses"][number]; return {id:e.id,farm_id:farmId,category:e.category,amount:e.amount,incurred_on:e.date,note:e.note}; }
  if (kind === "harvestEntries") { const e=item as FarmState["harvestEntries"][number]; return {id:e.id,farm_id:farmId,field_id:e.fieldId,harvested_on:e.harvestedOn,bushels:e.bushels,moisture_percent:e.moisturePercent,storage_bin:e.storageBin,notes:e.notes}; }
  if (kind === "grainSales") { const s=item as FarmState["grainSales"][number]; return {id:s.id,farm_id:farmId,crop:s.crop,storage_bin:s.storageBin,sold_on:s.soldOn,bushels:s.bushels,price_per_bushel:s.pricePerBushel,buyer:s.buyer,notes:s.notes}; }
  const e=item as FarmState["equipment"][number]; return {id:e.id,farm_id:farmId,name:e.name,status:e.status,note:e.note};
}
async function loadFarm(user: User): Promise<{ state: FarmState; farmId: string; workspaces: Workspace[]; harvestAvailable: boolean; salesAvailable: boolean }> {
  if (!supabase) throw new Error("Supabase is not configured");
  const membership=await supabase.from("farm_members").select("farm_id").eq("user_id",user.id);
  if (membership.error) throw membership.error;
  let farmIds=(membership.data??[]).map(row=>row.farm_id as string);
  if (!farmIds.length) {
    const farmId=newId();
    const created=await supabase.from("farms").insert({id:farmId,name:"My Farm",location:"Not set",season_year:new Date().getFullYear()});
    if (created.error) throw created.error;
    farmIds=[farmId];
  }
  const available=await supabase.from("farms").select("id,name,demo_seeded").in("id",farmIds).order("created_at",{ascending:true});
  if(available.error)throw available.error;
  const workspaces=(available.data??[]).map(row=>({id:row.id as string,name:row.name as string,demoSeeded:Boolean(row.demo_seeded)}));
  if(!workspaces.length)throw new Error("No farm workspace is available for this account.");
  const preferred=user.user_metadata?.active_farm_id;
  const farmId=workspaces.find(workspace=>workspace.id===preferred)?.id??workspaces[0].id;
  const [farm,fields,tasks,expenses,equipment,harvestEntries,grainSales]=await Promise.all([
    supabase.from("farms").select("name,location,season_year,demo_seeded").eq("id",farmId).single(),
    supabase.from("fields").select("*").eq("farm_id",farmId),
    supabase.from("farm_tasks").select("*").eq("farm_id",farmId),
    supabase.from("expenses").select("*").eq("farm_id",farmId),
    supabase.from("equipment").select("*").eq("farm_id",farmId),
    supabase.from("harvest_entries").select("*").eq("farm_id",farmId),
    supabase.from("grain_sales").select("*").eq("farm_id",farmId),
  ]);
  for(const result of [farm,fields,tasks,expenses,equipment]) if(result.error) throw result.error;
  if(harvestEntries.error && !["PGRST205","42P01"].includes(harvestEntries.error.code)) throw harvestEntries.error;
  if(grainSales.error && !["PGRST205","42P01"].includes(grainSales.error.code)) throw grainSales.error;
  return {farmId,workspaces,harvestAvailable:!harvestEntries.error,salesAvailable:!grainSales.error,state:{farmName:farm.data!.name,farmLocation:farm.data!.location??"Not set",seasonYear:farm.data!.season_year,demoSeeded:Boolean(farm.data!.demo_seeded),fields:(fields.data??[]).map(f=>({id:f.id,name:f.name,crop:f.crop,acres:Number(f.acres),planted:f.planted_on??"Not set",status:f.status,progress:f.progress,boundaryGeoJson:f.boundary_geojson??undefined,boundarySource:f.boundary_source??undefined,boundaryConfirmed:Boolean(f.boundary_confirmed)})),tasks:(tasks.data??[]).map(t=>({id:t.id,title:t.title,detail:t.detail,due:t.due_on??"Not set",priority:t.priority,done:t.done})),expenses:(expenses.data??[]).map(e=>({id:e.id,category:e.category,amount:Number(e.amount),date:e.incurred_on,note:e.note})),equipment:(equipment.data??[]).map(e=>({id:e.id,name:e.name,status:e.status,note:e.note})),harvestEntries:(harvestEntries.data??[]).map(e=>({id:e.id,fieldId:e.field_id,harvestedOn:e.harvested_on,bushels:Number(e.bushels),moisturePercent:e.moisture_percent===null?null:Number(e.moisture_percent),storageBin:e.storage_bin,notes:e.notes})),grainSales:(grainSales.data??[]).map(s=>({id:s.id,crop:s.crop,storageBin:s.storage_bin,soldOn:s.sold_on,bushels:Number(s.bushels),pricePerBushel:Number(s.price_per_bushel),buyer:s.buyer,notes:s.notes}))}};
}
export function FarmProvider({children}:{children:React.ReactNode}) {
  const [data,setData]=useState<FarmState>(initialFarmState);
  const [activeFarmId,setActiveFarmId]=useState<string|null>(null);
  const [workspaces,setWorkspaces]=useState<Workspace[]>([]);
  const [ready,setReady]=useState(false);
  const [user,setUser]=useState<User|null>(null);
  const [busy,setBusy]=useState(false);
  const [harvestAvailable,setHarvestAvailable]=useState(!supabase);
  const [salesAvailable,setSalesAvailable]=useState(!supabase);
  const [error,setError]=useState("");
  const [loadFailed,setLoadFailed]=useState(false);
  const [email,setEmail]=useState("");
  const [sent,setSent]=useState(false);
  const farmId=useRef<string|null>(null);
  const loadingUser=useRef<string|null>(null);
  const loadedUser=useRef<string|null>(null);
  useEffect(()=>{
    if(!supabase){
      try{const saved=localStorage.getItem(STORAGE_KEY);if(saved){const parsed=JSON.parse(saved) as Partial<FarmState>;queueMicrotask(()=>setData({...initialFarmState,...parsed,harvestEntries:parsed.harvestEntries??[],grainSales:parsed.grainSales??[]} as FarmState));}}catch{}
      queueMicrotask(()=>setReady(true));
      return;
    }
    let active=true;
    async function refresh(nextUser:User|null){
      if(!active)return;
      if(!nextUser){farmId.current=null;setActiveFarmId(null);setWorkspaces([]);loadedUser.current=null;loadingUser.current=null;setUser(null);setReady(true);return;}
      if(loadingUser.current===nextUser.id||loadedUser.current===nextUser.id)return;
      loadingUser.current=nextUser.id;farmId.current=null;setUser(nextUser);setReady(false);
      try{const loaded=await loadFarm(nextUser);if(!active)return;farmId.current=loaded.farmId;setActiveFarmId(loaded.farmId);setWorkspaces(loaded.workspaces);loadedUser.current=nextUser.id;setData(loaded.state);setHarvestAvailable(loaded.harvestAvailable);setSalesAvailable(loaded.salesAvailable);setError("");setLoadFailed(false);}
      catch(e){setError(messageOf(e));setLoadFailed(true);}
      finally{loadingUser.current=null;if(active)setReady(true);}
    }
    const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{queueMicrotask(()=>refresh(session?.user??null));});
    return()=>{active=false;listener.subscription.unsubscribe();};
  },[]);
  useEffect(()=>{if(ready&&!supabase){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}catch{queueMicrotask(()=>setError("Could not save records in this browser"));}}},[data,ready]);
  function applyLoaded(loaded:Awaited<ReturnType<typeof loadFarm>>){farmId.current=loaded.farmId;setActiveFarmId(loaded.farmId);setWorkspaces(loaded.workspaces);setData(loaded.state);setHarvestAvailable(loaded.harvestAvailable);setSalesAvailable(loaded.salesAvailable);}
  async function reload(){if(!user||!farmId.current)return;applyLoaded(await loadFarm(user));}
  async function saveRecord(kind:RecordKind,record:FarmRecord){
    if(busy)return false;
    setBusy(true);setError("");
    try{
      if(supabase){if(!farmId.current)throw new Error("Farm is still loading");const result=await supabase.from(tables[kind] as string).upsert(toRow(kind,record,farmId.current) as Record<string,unknown>);if(result.error)throw result.error;await reload();}
      else setData(previous=>({...previous,[kind]:[...previous[kind].filter(item=>item.id!==record.id),record]} as FarmState));
      return true;
    }catch(e){setError(messageOf(e));return false;}finally{setBusy(false);}
  }
  async function deleteRecord(kind:RecordKind,id:string){
    if(busy)return false;
    setBusy(true);setError("");
    try{
      if(supabase){if(!farmId.current)throw new Error("Farm is still loading");const result=await supabase.from(tables[kind]).delete({count:"exact"}).eq("id",id).eq("farm_id",farmId.current);if(result.error)throw result.error;if(result.count!==1)throw new Error("Record was not deleted; refresh and try again");await reload();}
      else setData(previous=>({...previous,[kind]:previous[kind].filter(item=>item.id!==id)} as FarmState));
      return true;
    }catch(e){setError(kind==="fields"&&e&&typeof e==="object"&&"code" in e&&e.code==="23503"?"This field has harvest entries. Remove those entries before deleting the field.":messageOf(e));return false;}finally{setBusy(false);}
  }
  async function saveFarmProfile(profile:FarmProfile){
    if(busy || !profile.name.trim() || !profile.location.trim() || !Number.isInteger(profile.seasonYear) || profile.seasonYear<2000 || profile.seasonYear>2100)return false;
    setBusy(true);setError("");
    try{
      if(supabase){if(!farmId.current)throw new Error("Farm is still loading");const result=await supabase.from("farms").update({name:profile.name.trim(),location:profile.location.trim(),season_year:profile.seasonYear}).eq("id",farmId.current).select("id").single();if(result.error)throw result.error;await reload();}
      else setData(previous=>({...previous,farmName:profile.name.trim(),farmLocation:profile.location.trim(),seasonYear:profile.seasonYear}));
      return true;
    }catch(e){setError(messageOf(e));return false;}finally{setBusy(false);}
  }
  async function selectFarm(id:string){
    if(!supabase||!user||busy||!workspaces.some(workspace=>workspace.id===id))return false;
    setBusy(true);setError("");
    try{
      const updated=await supabase.auth.updateUser({data:{active_farm_id:id}});
      if(updated.error||!updated.data.user)throw updated.error??new Error("Could not switch farms");
      const loaded=await loadFarm(updated.data.user);
      setUser(updated.data.user);applyLoaded(loaded);
      return true;
    }catch(e){setError(messageOf(e));return false;}finally{setBusy(false);}
  }
  async function createFarm(profile:FarmProfile){
    if(!supabase||!user||busy||!profile.name.trim()||!profile.location.trim()||!Number.isInteger(profile.seasonYear)||profile.seasonYear<2000||profile.seasonYear>2100)return false;
    setBusy(true);setError("");
    try{
      const id=newId();
      const created=await supabase.from("farms").insert({id,name:profile.name.trim(),location:profile.location.trim(),season_year:profile.seasonYear});
      if(created.error)throw created.error;
      const updated=await supabase.auth.updateUser({data:{active_farm_id:id}});
      if(updated.error||!updated.data.user)throw updated.error??new Error("Farm created, but switching to it failed. Reload and select it from Farm settings.");
      const loaded=await loadFarm(updated.data.user);
      setUser(updated.data.user);applyLoaded(loaded);
      return true;
    }catch(e){setError(messageOf(e));return false;}finally{setBusy(false);}
  }
  async function signIn(event:React.FormEvent){event.preventDefault();if(!supabase)return;setError("");const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin}});if(error)setError(error.message);else setSent(true);}
  async function signOut(){await supabase?.auth.signOut();farmId.current=null;setActiveFarmId(null);setWorkspaces([]);loadedUser.current=null;setUser(null);}
  if(supabase&&!ready)return <div className="auth-screen"><div className="auth-card"><div className="auth-logo">🌾 HarvestCompass</div><p>Loading your farm workspace…</p></div></div>;
  if(supabase&&user&&loadFailed)return <div className="auth-screen"><div className="auth-card"><div className="auth-logo">🌾 HarvestCompass</div><h1>Could not load your farm</h1><p className="auth-error">{error||"Please try again."}</p><button className="primary-button" onClick={()=>window.location.reload()}>Retry</button></div></div>;
  if(supabase&&!user)return <div className="auth-screen"><div className="auth-card"><div className="auth-logo">🌾 HarvestCompass</div><h1>Welcome to your farm workspace</h1><p>Sign in with an email link to keep your farm records in Supabase.</p>{sent?<p className="auth-notice">Check your email for a sign-in link.</p>:<form onSubmit={signIn}><label>Email address<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><button className="primary-button">Send sign-in link</button></form>}{error&&<p className="auth-error">{error}</p>}</div></div>;
  return <Context.Provider value={{data,farmId:activeFarmId,workspaces,ready,hosted:!!supabase,harvestAvailable,salesAvailable,user,busy,error,saveRecord,deleteRecord,saveFarmProfile,createFarm,switchFarm:selectFarm,refreshFarm:reload,signOut}}>{error&&<div className="sync-error" role="alert">Save error: {error}</div>}{children}</Context.Provider>;
}
function messageOf(error:unknown){return error&&typeof error==="object"&&"message" in error?String(error.message):"Something went wrong. Please try again.";}
export function useFarm(){const value=useContext(Context);if(!value)throw new Error("FarmProvider is missing");return value;}
