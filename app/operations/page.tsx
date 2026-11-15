"use client";
import Link from "next/link";
import { ArrowRight, Sprout, Tractor, Wrench, Wheat } from "lucide-react";
import { Shell } from "@/components/shell";
import { FarmRecords } from "@/components/farm-records";
import { useFarm } from "@/components/farm-provider";

export default function Operations() {
  const { data } = useFarm();
  const planted = data.fields.filter(field => field.planted !== "Not set" && !!field.planted).length;
  const attention = data.fields.filter(field => field.status === "Needs attention").length;
  const service = data.equipment.filter(item => item.status === "Needs service").length;
  const ready = data.equipment.filter(item => item.status === "Ready").length;
  return <Shell>
    <div className="demo-label">{data.demoSeeded ? "DEMO-SEED WORKSPACE · EDIT RECORDS TO MATCH YOUR FARM" : "SAVED FARM OPERATIONS"}</div>
    <section className="section-hero"><div className="section-icon"><Tractor size={30}/></div><div><span className="eyebrow">BEFORE & DURING HARVEST</span><h2>Keep the season moving</h2><p>Update field progress and equipment status here. The dashboard and assistant use these same saved records.</p></div></section>
    <section className="harvest-stats" aria-label="Operation status">
      <div className="kpi"><span className="kpi-icon green"><Sprout size={21}/></span><span className="kpi-label">Fields planted</span><strong>{planted} <small>of {data.fields.length}</small></strong></div>
      <div className="kpi"><span className="kpi-icon peach"><Wheat size={21}/></span><span className="kpi-label">Fields needing attention</span><strong>{attention}</strong></div>
      <div className="kpi"><span className="kpi-icon blue"><Wrench size={21}/></span><span className="kpi-label">Equipment ready</span><strong>{ready} <small>of {data.equipment.length}</small></strong><span className="kpi-note">{service} need service</span></div>
    </section>
    <div className="profile-links"><Link href="/farm-map">Select an estimated field <ArrowRight size={15}/></Link><Link href="/action-plan">Manage tasks <ArrowRight size={15}/></Link><Link href="/harvest">Record harvest <ArrowRight size={15}/></Link></div>
    <FarmRecords kind="fields"/><FarmRecords kind="equipment"/>
  </Shell>;
}
