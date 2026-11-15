"use client";
import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined, Coins, Download, Sprout, Wheat } from "lucide-react";
import { Shell } from "@/components/shell";
import { FarmRecords } from "@/components/farm-records";
import { ExpenseChart } from "@/components/expense-chart";
import { useFarm } from "@/components/farm-provider";

function csvCell(value: string | number) {
  const text = String(value);
  const safe = /^[=+@-]/.test(text) && typeof value === "string" ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

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
  function exportCsv() {
    const rows: (string | number)[][] = [["Record type", "Name", "Crop", "Acres", "Date", "Bushels", "Amount", "Status"]];
    for (const field of data.fields) rows.push(["Field", field.name, field.crop, field.acres, field.planted, "", "", field.status]);
    for (const entry of data.harvestEntries) rows.push(["Harvest", data.fields.find(field => field.id === entry.fieldId)?.name ?? "Deleted field", "", "", entry.harvestedOn, entry.bushels, "", entry.storageBin]);
    for (const expense of data.expenses) rows.push(["Expense", expense.category, "", "", expense.date, "", expense.amount, expense.note]);
    for (const sale of data.grainSales) rows.push(["Grain sale", sale.storageBin + (sale.buyer ? " · " + sale.buyer : ""), sale.crop, "", sale.soldOn, sale.bushels, (sale.bushels * sale.pricePerBushel).toFixed(2), "Sold at $" + sale.pricePerBushel + "/bu"]);
    for (const task of data.tasks) rows.push(["Task", task.title, "", "", task.due, "", "", task.done ? "Complete" : task.priority + " priority"]);
    const csv = rows.map(row => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "harvestcompass-" + data.seasonYear + "-report.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <Shell>
    <div className="demo-label">{data.demoSeeded ? "DEMO-SEED WORKSPACE · REPORT INCLUDES FICTIONAL RECORDS" : "SAVED SEASON REPORT"}</div>
    <section className="section-hero"><div className="section-icon"><ChartNoAxesCombined size={30}/></div><div><span className="eyebrow">{data.seasonYear} SEASON</span><h2>See the full story of your season</h2><p>These totals come from your saved fields, expenses, and harvest entries.</p></div></section>
    <div className="report-actions"><button type="button" className="primary-button" onClick={exportCsv}><Download size={16}/> Download season CSV</button></div>
    <section className="harvest-stats" aria-label="Season totals">
      <div className="kpi"><span className="kpi-icon green"><Wheat size={21}/></span><span className="kpi-label">Recorded production</span><strong>{totalBushels.toLocaleString()} <small>bu</small></strong></div>
      <div className="kpi"><span className="kpi-icon blue"><Coins size={21}/></span><span className="kpi-label">Logged expenses</span><strong>${totalExpenses.toLocaleString()}</strong></div>
      <div className="kpi"><span className="kpi-icon gold"><Sprout size={21}/></span><span className="kpi-label">Grain sold</span><strong>{soldBushels.toLocaleString()} <small>bu</small></strong><span className="kpi-note">${salesRevenue.toLocaleString()} recorded revenue</span></div>
    </section>
    <section className="records-panel"><div className="records-head"><div><h3>Crop summary</h3><p>Bushels reflect recorded harvest entries; unlogged production is excluded.</p></div><Link className="text-link" href="/harvest">Harvest log <ArrowRight size={15}/></Link></div><div className="inventory-table"><div className="inventory-head"><span>Crop</span><span>Fields</span><span>Acres</span><span>Recorded bushels</span></div>{cropRows.map(row => <div className="inventory-row" key={row.crop}><strong>{row.crop}</strong><span>{row.fields}</span><span>{row.acres.toLocaleString()}</span><strong>{row.bushels.toLocaleString()} bu</strong></div>)}</div></section>
    <section className="panel report-chart"><div className="panel-heading"><div><h3>Expense breakdown</h3><p>Grouped by saved expense category</p></div></div><ExpenseChart/></section>
    <FarmRecords kind="expenses"/>
  </Shell>;
}
