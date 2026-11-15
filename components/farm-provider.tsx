"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { initialFarmState, newId, type FarmState } from "@/lib/farm-store";
import { supabase } from "@/lib/supabase-client";
const STORAGE_KEY = "harvestcompass-farm-v1";
type FarmContext = { data: FarmState; setData: React.Dispatch<React.SetStateAction<FarmState>>; ready: boolean; hosted: boolean; user: User | null; signOut: () => Promise<void> };
const Context = createContext<FarmContext | null>(null);
const tables = { fields: "fields", tasks: "farm_tasks", expenses: "expenses", equipment: "equipment" } as const;
function demoDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(`${value}, 2026`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0,10);
}
function toRow(kind: keyof typeof tables, item: FarmState[typeof kind][number], farmId: string) {
  if (kind === "fields") { const f=item as FarmState["fields"][number]; return {id:f.id,farm_id:farmId,name:f.name,crop:f.crop,acres:f.acres,planted_on:demoDate(f.planted),status:f.status,progress:f.progress}; }
  if (kind === "tasks") { const t=item as FarmState["tasks"][number]; return {id:t.id,farm_id:farmId,title:t.title,detail:t.detail,due_on:demoDate(t.due),priority:t.priority,done:t.done}; }
  if (kind === "expenses") { const e=item as FarmState["expenses"][number]; return {id:e.id,farm_id:farmId,category:e.category,amount:e.amount,incurred_on:e.date,note:e.note}; }
  const e=item as FarmState["equipment"][number]; return {id:e.id,farm_id:farmId,name:e.name,status:e.status,note:e.note};
}
async function loadFarm(user: User): Promise<{ state: FarmState; farmId: string }> {
  if (!supabase) throw new Error("Supabase is not configured");
  const membership=await supabase.from("farm_members").select("farm_id").eq("user_id",user.id).limit(1).maybeSingle();
  if (membership.error) throw membership.error;
  let farmId=membership.data?.farm_id as string | undefined;
  if (!farmId) {
    const created=await supabase.from("farms").insert({name:initialFarmState.farmName,location:"Brookings County, South Dakota",season_year:2026}).select("id").single();
    if (created.error) throw created.error; farmId=created.data.id;
    const seed:FarmState={...initialFarmState,fields:initialFarmState.fields.map(f=>({...f,id:newId()})),tasks:initialFarmState.tasks.map(t=>({...t,id:newId()})),expenses:initialFarmState.expenses.map(e=>({...e,id:newId()})),equipment:initialFarmState.equipment.map(e=>({...e,id:newId()}))};
    for (const kind of Object.keys(tables) as (keyof typeof tables)[]) { const rows=seed[kind].map(item=>toRow(kind,item,farmId!)); const result=await supabase.from(tables[kind]).insert(rows); if(result.error) throw result.error; }
  }
  const [farm,fields,tasks,expenses,equipment]=await Promise.all([
    supabase.from("farms").select("name").eq("id",farmId).single(),
    supabase.from("fields").select("*").eq("farm_id",farmId),
    supabase.from("farm_tasks").select("*").eq("farm_id",farmId),
    supabase.from("expenses").select("*").eq("farm_id",farmId),
    supabase.from("equipment").select("*").eq("farm_id",farmId),
  ]);
  for(const result of [farm,fields,tasks,expenses,equipment]) if(result.error) throw result.error;
  return {farmId:farmId!,state:{farmName:farm.data!.name,fields:(fields.data??[]).map(f=>({id:f.id,name:f.name,crop:f.crop,acres:Number(f.acres),planted:f.planted_on??"Not set",status:f.status,progress:f.progress})),tasks:(tasks.data??[]).map(t=>({id:t.id,title:t.title,detail:t.detail,due:t.due_on??"Not set",priority:t.priority,done:t.done})),expenses:(expenses.data??[]).map(e=>({id:e.id,category:e.category,amount:Number(e.amount),date:e.incurred_on,note:e.note})),equipment:(equipment.data??[]).map(e=>({id:e.id,name:e.name,status:e.status,note:e.note}))}};
}
export function FarmProvider({children}:{children:React.ReactNode}) {
  const [data,setData]=useState<FarmState>(initialFarmState); const [ready,setReady]=useState(false); const [user,setUser]=useState<User|null>(null); const [error,setError]=useState(""); const [email,setEmail]=useState(""); const [sent,setSent]=useState(false);
  const farmId=useRef<string|null>(null); const loadingUser=useRef<string|null>(null); const loadedUser=useRef<string|null>(null); const previous=useRef<FarmState>(initialFarmState);
  useEffect(()=>{
    if(!supabase){try{const saved=localStorage.getItem(STORAGE_KEY);if(saved)queueMicrotask(()=>setData(JSON.parse(saved) as FarmState));}catch{}queueMicrotask(()=>setReady(true));return;}
    let active=true;
    async function refresh(nextUser:User|null){if(!active)return;if(!nextUser){farmId.current=null;loadedUser.current=null;loadingUser.current=null;setUser(null);setReady(true);return;}if(loadingUser.current===nextUser.id||loadedUser.current===nextUser.id)return;loadingUser.current=nextUser.id;farmId.current=null;setUser(nextUser);setReady(false);try{const loaded=await loadFarm(nextUser);if(!active)return;farmId.current=loaded.farmId;loadedUser.current=nextUser.id;previous.current=loaded.state;setData(loaded.state);setError("");}catch(e){setError(e instanceof Error?e.message:"Unable to load farm");}finally{loadingUser.current=null;if(active)setReady(true);}}
    const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{queueMicrotask(()=>refresh(session?.user??null));});return()=>{active=false;listener.subscription.unsubscribe();};
  },[]);
  useEffect(()=>{if(!ready)return;if(!supabase){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return;}if(!user||!farmId.current)return;const before=previous.current;previous.current=data;const id=farmId.current;for(const kind of Object.keys(tables) as (keyof typeof tables)[]){const oldItems=before[kind];const newItems=data[kind];for(const item of newItems){const old=oldItems.find(x=>x.id===item.id);if(!old||JSON.stringify(old)!==JSON.stringify(item))supabase.from(tables[kind] as string).upsert(toRow(kind,item,id) as Record<string, unknown>).then(({error})=>{if(error)setError(error.message);});}for(const old of oldItems){if(!newItems.some(x=>x.id===old.id))supabase.from(tables[kind]).delete().eq("id",old.id).eq("farm_id",id).then(({error})=>{if(error)setError(error.message);});}}
  },[data,ready,user]);
  async function signIn(event:React.FormEvent){event.preventDefault();if(!supabase)return;setError("");const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin}});if(error)setError(error.message);else setSent(true);}
  async function signOut(){await supabase?.auth.signOut();setUser(null);}
  if(supabase&&!ready)return <div className="auth-screen"><div className="auth-card"><div className="auth-logo">🌾 HarvestCompass</div><p>Loading your farm workspace…</p></div></div>;
  if(supabase&&!user)return <div className="auth-screen"><div className="auth-card"><div className="auth-logo">🌾 HarvestCompass</div><h1>Welcome to your farm workspace</h1><p>Sign in with an email link to keep your farm records in Supabase.</p>{sent?<p className="auth-notice">Check your email for a sign-in link.</p>:<form onSubmit={signIn}><label>Email address<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><button className="primary-button">Send sign-in link</button></form>}{error&&<p className="auth-error">{error}</p>}</div></div>;
  return <Context.Provider value={{data,setData,ready,hosted:!!supabase,user,signOut}}>{error&&<div className="sync-error" role="alert">Sync error: {error}</div>}{children}</Context.Provider>;
}
export function useFarm(){const value=useContext(Context);if(!value)throw new Error("FarmProvider is missing");return value;}
