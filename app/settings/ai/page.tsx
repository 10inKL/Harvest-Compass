"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CloudSun, ExternalLink, KeyRound, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Shell } from "@/components/shell";
import { ForecastLocationPicker } from "@/components/forecast-location-picker";
import { supabase } from "@/lib/supabase-client";
import { useFarm } from "@/components/farm-provider";
import styles from "./settings.module.css";

type Config={configured:boolean;model:string;schemaReady:boolean;location:{latitude:number|null;longitude:number|null}|null};
export default function AISettings(){const {farmId}=useFarm();return <AssistantSettings key={farmId??"local"}/>;}
function AssistantSettings(){
  const {hosted,data}=useFarm();
  const [config,setConfig]=useState<Config|null>(null),[loading,setLoading]=useState(true),[testing,setTesting]=useState(false),[connection,setConnection]=useState("Not tested"),[error,setError]=useState(""),[savedLocation,setSavedLocation]=useState("");
  const authFetch=useCallback(async(url:string,options?:RequestInit)=>{
    const token=hosted?(await supabase?.auth.getSession())?.data.session?.access_token:null;
    return fetch(url,{...options,headers:{...options?.headers,...(token?{Authorization:`Bearer ${token}`}:{})},cache:"no-store"});
  },[hosted]);
  useEffect(()=>{
    const controller=new AbortController();
    void(async()=>{
      try{const response=await authFetch("/api/assistant/config",{signal:controller.signal});const result=await response.json();if(controller.signal.aborted)return;if(!response.ok)throw new Error(result.error||"Settings could not be loaded. Please try again.");setConfig(result);}
      catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:"Settings could not be loaded.");}
      finally{if(!controller.signal.aborted)setLoading(false);}
    })();return()=>controller.abort();
  },[authFetch]);
  async function testConnection(){
    setTesting(true);setError("");
    try{const response=await authFetch("/api/assistant/config",{method:"POST"});const result=await response.json();if(!response.ok||!result.connected)throw new Error(result.error||"The assistant connection could not be verified.");setConnection("Connected");}
    catch(error){setConnection("Check failed");setError(error instanceof Error?error.message:"Connection check failed.");}
    finally{setTesting(false);}
  }
  const hasLocation=config?.location?.latitude!=null&&config?.location?.longitude!=null;
  return <Shell><div className="settings-page"><div className="demo-label">SETTINGS · ASSISTANT & WEATHER</div><div className="settings-hero"><span><CloudSun size={22}/></span><div><h2>Assistant & weather settings</h2><p>Choose where your farm forecast comes from and check your assistant’s availability.</p></div></div>
    <div className="settings-grid">
      <section className="settings-card"><div className="settings-card-heading"><CloudSun size={20}/><div><h3>Farm forecast location</h3><p>Choose a town or one of your mapped fields</p></div></div>
        <p className="settings-copy">{savedLocation?"Your forecast location is now "+savedLocation+".":loading?"Loading your forecast settings…":hasLocation?"A forecast location is saved for this farm. Choose below to change it.":"Your dashboard can use a mapped field automatically. You can also choose a town or field below."}</p>
        <ForecastLocationPicker fields={data.fields} authFetch={authFetch} disabled={!hosted} onSaved={label=>setSavedLocation(label)}/>
        {savedLocation&&<p className="settings-success" role="status">Forecast location saved. Your dashboard and assistant will use this location.</p>}
        <p className="settings-copy">Forecasts come from <a href="https://www.weather.gov/" target="_blank" rel="noreferrer">NOAA National Weather Service <ExternalLink size={12}/></a>. The dashboard shows forecast dates and source times.</p><Link className="text-link" href="/dashboard">View your farm forecast →</Link>
      </section>
      <section className="settings-card"><div className="settings-card-heading"><Sparkles size={20}/><div><h3>Your farm assistant</h3><p>Use your saved records to ask questions and compare plans</p></div></div>
        <div className="settings-status" role="status"><span className={config?.configured?"status-dot on":"status-dot"}/><strong>{loading?"Checking configuration…":config?.configured?"Connection configured":"Setup needed"}</strong></div>
        <p className="settings-copy">{config?.configured?"Your assistant connection is configured. You can ask questions from AI Assistant; plan changes still need your approval.":"The person managing HarvestCompass needs to finish the assistant connection. Your farm records and forecast settings remain available."}</p>
        <Link href="/ai-assistant" className="text-link">Open AI Assistant →</Link>
        <details className={styles.advanced}><summary><KeyRound size={15}/> Advanced connection setup</summary><p className="settings-copy">For the person managing this app. Farmers do not need to enter an API key.</p><p className="settings-fine">Provider: OpenAI · Model: {config?.model??"Unavailable"}<br/>Connection check: {connection}</p>
          <p className="settings-copy">For local development, add these server settings to the project’s <code>.env.local</code> and restart the development server:</p><pre className="settings-code">OPENAI_API_KEY=your_key_here{"\n"}OPENAI_MODEL=gpt-5-mini</pre><p className="settings-copy">To remove a key, delete its environment variable and restart. Production uses server environment variables.</p><div className="settings-note"><ShieldCheck size={17}/><span>Keys stay on the server. This app does not save keys in the browser or offer an insecure key-saving form.</span></div>
          <button type="button" className="primary-button" onClick={testConnection} disabled={!hosted||!config?.configured||testing}>{testing?<LoaderCircle size={16} className="spin"/>:<CheckCircle2 size={16}/>} Check assistant connection</button><p className="settings-fine">Runs a small live OpenAI request only when clicked.</p>
          {config&&!config.schemaReady&&hosted&&<p className="settings-copy">Assistant database setup is incomplete. Apply <code>supabase/migrations/202611150002_assistant.sql</code> before using chat.</p>}
        </details>
      </section>
    </div>{error&&<p className="chat-error" role="alert">{error}</p>}<Link className="settings-back" href="/settings/farm">← Back to Farm Settings</Link>
  </div></Shell>;
}
