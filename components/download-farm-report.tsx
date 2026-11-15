"use client";
import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import { useFarm } from "./farm-provider";
import type { ReportAdvice } from "@/lib/season-report-pdf";

export function DownloadFarmReport(){
  const {data,hosted,ready,busy}=useFarm();
  const [exporting,setExporting]=useState(false);
  const [error,setError]=useState("");
  async function download(){
    if(exporting)return;
    setExporting(true);setError("");
    const snapshot=structuredClone(data);
    let insights:ReportAdvice={recommendations:[]};
    try{
      if(hosted){try{const token=(await supabase?.auth.getSession())?.data.session?.access_token;const response=await fetch("/api/reports/advice",{method:"POST",headers:token?{Authorization:`Bearer ${token}`}:{},cache:"no-store"});const result=await response.json();if(response.ok)insights=result;else insights.unavailable="AI assessment is unavailable.";}catch{insights.unavailable="AI assessment is unavailable.";}}
      const {downloadSeasonReport}=await import("@/lib/season-report-pdf");downloadSeasonReport(snapshot,insights);
    }catch{setError("The PDF could not be generated. Please try again.");}finally{setExporting(false);}
  }
  return <div><button type="button" className="primary-button" style={{minHeight:48,padding:"12px 20px",fontSize:14}} onClick={download} disabled={exporting||busy||!ready} title="Download your farm records with an AI assessment of current data">{exporting?<LoaderCircle size={19} className="spin"/>:<Download size={19}/>} {exporting?"Preparing report…":"Download farm report (PDF)"}</button>{error&&<p className="record-error" role="alert">{error}</p>}</div>;
}
