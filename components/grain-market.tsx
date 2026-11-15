"use client";
import { useEffect, useState } from "react";
import { ExternalLink, LoaderCircle, RefreshCw, Sprout, Wheat } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import { GRAIN_REGIONS, GRAIN_REPORT_URL, marketIsOlder, type GrainMarket, type GrainRegion } from "@/lib/grain-market";
import styles from "./grain-market.module.css";

const money=(value:number|null)=>value===null?"—":"$"+value.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:4});
const reportDate=(date:string)=>new Date(date+"T12:00:00Z").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"America/Chicago"});
export function GrainMarketPanel(){
  const [market,setMarket]=useState<GrainMarket|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[configured,setConfigured]=useState(true),[revision,setRevision]=useState(0);
  const [region,setRegion]=useState<GrainRegion>("East Central");
  useEffect(()=>{
    const controller=new AbortController();
    void(async()=>{
      setLoading(true);setError("");setMarket(null);
      try{
        const token=(await supabase?.auth.getSession())?.data.session?.access_token;
        if(controller.signal.aborted)return;
        if(!token){setError("Sign in to see grain prices.");return;}
        const response=await fetch("/api/market-prices",{headers:{Authorization:`Bearer ${token}`},signal:controller.signal,cache:"no-store"});
        const result=await response.json();if(controller.signal.aborted)return;
        if(!response.ok)throw new Error(result.error||"Market prices are unavailable.");
        setConfigured(result.configured);if(result.configured)setMarket(result);
      }catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:"Market prices are unavailable.");}
      finally{if(!controller.signal.aborted)setLoading(false);}
    })();return()=>controller.abort();
  },[revision]);
  return <section className={styles.panel} aria-label="Grain selling prices">
    <header className={styles.heading}><div><span className={styles.eyebrow}>YOUR MARKET WATCH</span><h2>Grain cash bids</h2><p>What grain buyers are offering</p></div><Wheat size={23} strokeWidth={1.5}/></header>
    <label className={styles.region}>South Dakota region<select value={region} onChange={event=>setRegion(event.target.value as GrainRegion)}>{GRAIN_REGIONS.map(name=><option key={name}>{name}</option>)}</select></label>
    {loading?<div className={styles.message} role="status"><LoaderCircle size={17} className={styles.spin}/>Checking the latest USDA report…</div>:error?<div className={styles.message} role="alert"><p>{error}</p><button type="button" onClick={()=>setRevision(value=>value+1)}><RefreshCw size={13}/> Try again</button></div>:!configured?<div className={styles.message}><p>Grain prices aren’t connected yet.</p><span>You can still view the free USDA report below.</span></div>:market&&<>
      <div className={styles.cards}>{(["Corn","Soybeans"] as const).map(crop=>{
        const bid=market.bids.find(item=>item.crop===crop&&item.region===region);
        const Icon=crop==="Corn"?Wheat:Sprout;
        return <article className={`${styles.card} ${crop==="Corn"?styles.corn:styles.soy}`} key={crop}><span className={styles.crop}><Icon size={16}/>{crop}</span><div className={styles.price}>{bid?money(bid.average):"—"}<small>{bid?.average!==null&&bid?"/ bu average":"Average unavailable"}</small></div><p>{bid?.low!==null&&bid?.high!==null&&bid?`${money(bid.low)}–${money(bid.high)} / bu`:(bid?"Bid range unavailable":"Not reported for this region")}</p>{bid&&<small className={styles.delivery}>Current delivery{bid.grade?" · "+bid.grade:""}</small>}</article>;
      })}</div>
      <div className={styles.asof}><span>Report: {reportDate(market.reportDate)}</span><small>{marketIsOlder(market.reportDate)?"Older report · check with your buyer":"Latest available report"}</small></div>
    </>}
    <footer className={styles.footer}><a href={GRAIN_REPORT_URL} target="_blank" rel="noreferrer">USDA · South Dakota Grain Bids <ExternalLink size={11}/></a>{market&&<small>Retrieved {new Date(market.retrievedAt).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/Chicago",timeZoneName:"short"})}</small>}<p>Regional cash bids, not futures or a guaranteed offer. Quality, delivery and deductions affect your final payment.</p></footer>
  </section>;
}
