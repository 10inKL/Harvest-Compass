"use client";
import Link from "next/link";
import { DownloadFarmReport } from "@/components/download-farm-report";
import { ArrowRight, ChartNoAxesCombined, Coins, Sprout, Wheat } from "lucide-react";
import { Shell } from "@/components/shell";
import { FarmRecords } from "@/components/farm-records";
import { ExpenseChart } from "@/components/expense-chart";
import { useFarm } from "@/components/farm-provider";

export default function Reports() {
  const { data } = useFarm();
  const totalExpenses = data.expenses.reduce((sum, item) => sum + item.amount, 0);
  const totalBushels = data.harvestEntries.reduce((sum, item) => sum + item.bushels, 0);
  const soldBushels = data.grainSales.reduce((sum, sale) => sum + sale.bushels, 0);
  const salesRevenue = data.grainSales.reduce((sum, sale) => sum + sale.bushels * sale.pricePerBushel, 0);
  const cropRows = (["Corn", "Soybeans"] as const).map(crop => {
    const fields = data.fields.filter(field => field.crop === crop);
    const ids = new Set(fields.map(field => field.id));
    return { crop, fields: fields.length, acres: fields.reduce((sum, field) => sum + field.acres, 0), bushels: data.harvestEntries.filter(entry => ids.has(entry.fieldId)).reduce((sum, entry) => sum + entry.bushels, 0) };
  });
  return <Shell><div className="farmer-season-report">
    <div className="season-print-heading"><h1>{data.farmName} · {data.seasonYear} season report</h1><p>{data.farmLocation}</p></div>
    <div className="demo-label">{data.demoSeeded ? "DEMO-SEED WORKSPACE · REPORT INCLUDES FICTIONAL RECORDS" : "SAVED SEASON REPORT"}</div>
    <section className="section-hero"><div className="section-icon"><ChartNoAxesCombined size={30}/></div><div><span className="eyebrow">{data.seasonYear} SEASON</span><h2>See the full story of your season</h2><p>These totals come from your saved fields, expenses, and harvest entries.</p></div></section>
    <div className="report-actions" style={{display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:16,marginTop:20}}><div><h2 style={{fontSize:22,fontWeight:750,margin:0}}>Expenses & season reports</h2><p style={{margin:"6px 0 0",color:"var(--muted)",fontSize:13}}>Record your farm costs and review your season results.</p></div><DownloadFarmReport/></div>
    <p style={{fontSize:12,color:"var(--muted)"}}>Includes your farm profile, fields, progress, tasks, expenses, harvest, sales, and a fresh management assessment. Downloading requests a short AI review of your current records.</p>
    <FarmRecords kind="expenses"/>
    <section className="harvest-stats" aria-label="Season totals">
      <div className="kpi"><span className="kpi-icon green"><Wheat size={21}/></span><span className="kpi-label">Recorded production</span><strong>{totalBushels.toLocaleString()} <small>bu</small></strong></div>
      <div className="kpi"><span className="kpi-icon blue"><Coins size={21}/></span><span className="kpi-label">Logged expenses</span><strong>${totalExpenses.toLocaleString()}</strong></div>
      <div className="kpi"><span className="kpi-icon gold"><Sprout size={21}/></span><span className="kpi-label">Grain sold</span><strong>{soldBushels.toLocaleString()} <small>bu</small></strong><span className="kpi-note">${salesRevenue.toLocaleString()} recorded revenue</span></div>
    </section>
    <section className="records-panel"><div className="records-head"><div><h3>Crop summary</h3><p>Bushels reflect recorded harvest entries; unlogged production is excluded.</p></div><Link className="text-link" href="/harvest">Harvest log <ArrowRight size={15}/></Link></div><div className="inventory-table"><div className="inventory-head"><span>Crop</span><span>Fields</span><span>Acres</span><span>Recorded bushels</span></div>{cropRows.map(row => <div className="inventory-row" key={row.crop}><strong>{row.crop}</strong><span>{row.fields}</span><span>{row.acres.toLocaleString()}</span><strong>{row.bushels.toLocaleString()} bu</strong></div>)}</div></section>
    <section className="panel report-chart"><div className="panel-heading"><div><h3>Expense breakdown</h3><p>Grouped by saved expense category</p></div></div><ExpenseChart/></section>
  </div></Shell>;
}
