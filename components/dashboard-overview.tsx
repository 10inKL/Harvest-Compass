"use client";
import Link from "next/link";
import { ArrowRight, CalendarDays, CircleAlert, ClipboardList, Coins, MapPinned, Sprout, Tractor, Wheat, Sparkles, Clock3 } from "lucide-react";
import { Shell } from "@/components/shell";
import { ExpenseChart } from "@/components/expense-chart";
import { useFarm } from "@/components/farm-provider";
import { FarmHomeHeader } from "@/components/farm-home-header";

export default function Dashboard() {
  const { data, harvestAvailable } = useFarm();
  const totalAcres = data.fields.reduce((sum, field) => sum + field.acres, 0);
  const totalExpenses = data.expenses.reduce((sum, item) => sum + item.amount, 0);
  const openTasks = data.tasks.filter(task => !task.done);
  const highTasks = openTasks.filter(task => task.priority === "High");
  const serviceNeeded = data.equipment.filter(item => item.status === "Needs service");
  const bushels = data.harvestEntries.reduce((sum, entry) => sum + entry.bushels, 0);
  const fieldCount = data.fields.length;
  const operations = [
    { label: "Fields planted", value: fieldCount ? Math.round(data.fields.filter(field => field.planted !== "Not set" && !!field.planted).length / fieldCount * 100) : 0, icon: Sprout },
    { label: "Average field progress", value: fieldCount ? Math.round(data.fields.reduce((sum, field) => sum + field.progress, 0) / fieldCount) : 0, icon: Wheat },
    { label: "Equipment ready", value: data.equipment.length ? Math.round(data.equipment.filter(item => item.status === "Ready").length / data.equipment.length * 100) : 0, icon: Tractor },
  ];
  const activity = [
    ...data.harvestEntries.map(entry => ({ key: "h" + entry.id, title: entry.bushels.toLocaleString() + " bu harvest recorded", detail: (data.fields.find(field => field.id === entry.fieldId)?.name ?? "Field") + " · " + entry.harvestedOn, date: entry.harvestedOn })),
    ...data.expenses.map(expense => ({ key: "e" + expense.id, title: expense.category + " expense logged", detail: "$" + expense.amount.toLocaleString() + " · " + expense.date, date: expense.date })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const attention = serviceNeeded[0] ? serviceNeeded[0].name + " needs service. Review it before assigning harvest work." : highTasks[0] ? highTasks[0].title + " is a high priority open task." : "Your saved records show no high priority tasks or equipment service flags.";
  return <Shell>
    <FarmHomeHeader/>
    <section className="kpi-grid" aria-label="Farm summary">
      <div className="kpi"><span className="kpi-icon green"><MapPinned size={21}/></span><span className="kpi-label">Total acreage</span><strong>{totalAcres.toLocaleString()} <small>acres</small></strong><span className="kpi-note">Across {fieldCount} saved fields</span></div>
      <div className="kpi"><span className="kpi-icon gold"><Wheat size={21}/></span><span className="kpi-label">Active fields</span><strong>{fieldCount} <small>fields</small></strong><span className="kpi-note">{data.fields.filter(f => f.crop === "Corn").length} corn · {data.fields.filter(f => f.crop === "Soybeans").length} soybeans</span></div>
      <div className="kpi"><span className="kpi-icon blue"><Coins size={21}/></span><span className="kpi-label">Logged expenses</span><strong>${totalExpenses.toLocaleString()}</strong><span className="kpi-note">From {data.expenses.length} expense records</span></div>
      <div className="kpi"><span className="kpi-icon peach"><CircleAlert size={21}/></span><span className="kpi-label">Requires attention</span><strong>{openTasks.length + serviceNeeded.length} <small>items</small></strong><span className="kpi-note attention">{highTasks.length} high priority · {serviceNeeded.length} service flags</span></div>
    </section>
    <div className="dashboard-grid"><div className="dashboard-main">
      <section className="panel"><div className="panel-heading"><div><h3>Field overview</h3><p>Saved crop and acreage records</p></div><Link href="/farm-map" className="text-link">View farm map <ArrowRight size={15}/></Link></div>{fieldCount ? <div className="field-grid">{data.fields.map(field => <div className="field-card" key={field.id}><div className={"field-visual " + (field.crop === "Corn" ? "corn" : "soy")}><span>{field.crop === "Corn" ? <Wheat size={28}/> : <Sprout size={28}/>}</span><span className="field-acres">{field.acres} ac</span></div><div className="field-info"><div><h4>{field.name}</h4><span className={"status " + (field.status === "Needs attention" ? "warning" : "ok")}>{field.status}</span></div><p>{field.crop} <span>·</span> Planted {field.planted}</p><div className="field-progress"><span>Season progress</span><strong>{field.progress}%</strong></div><div className="bar"><span style={{width:field.progress + "%"}}/></div></div></div>)}</div> : <p className="section-empty">No fields yet. Select a boundary on the map or add a field in operations.</p>}</section>
      <div className="two-col"><section className="panel"><div className="panel-heading"><div><h3>Farm operations</h3><p>Calculated from saved records</p></div><Link href="/operations" className="text-link">Manage <ArrowRight size={15}/></Link></div><div className="operation-list">{operations.map(({label,value,icon:Icon}) => <div className="operation" key={label}><div className="operation-top"><span className="operation-icon"><Icon size={17}/></span><strong>{label}</strong><span>{value}%</span></div><div className="bar"><span style={{width:value + "%"}}/></div></div>)}</div></section><section className="panel"><div className="panel-heading"><div><h3>Expense breakdown</h3><p>Logged {data.seasonYear} costs</p></div><Coins size={18} className="muted-icon"/></div><ExpenseChart/></section></div>
      {harvestAvailable && <section className="panel harvest-preview"><div className="panel-heading"><div><h3>Harvest & grain</h3><p>Recorded yield flows into inventory</p></div><Wheat size={18} className="muted-icon"/></div><div className="harvest-preview-total"><strong>{bushels.toLocaleString()} bu</strong><span>recorded across {data.harvestEntries.length} harvest entries</span></div><div className="harvest-preview-links"><Link href="/harvest" className="text-link">Record harvest <ArrowRight size={15}/></Link><Link href="/inventory" className="text-link">View inventory <ArrowRight size={15}/></Link></div></section>}
    </div><div className="dashboard-side">
      <section className="panel"><div className="panel-heading"><div><h3>Open tasks</h3><p>From your action plan</p></div><ClipboardList size={18} className="muted-icon"/></div>{openTasks.length ? <div className="task-list">{openTasks.slice(0,3).map(task => <div className="task" key={task.id}><div className="task-date"><CalendarDays size={14}/>{task.due}</div><strong>{task.title}</strong><p>{task.detail}</p><span className={"priority " + task.priority.toLowerCase()}>{task.priority} priority</span></div>)}</div> : <p className="section-empty">No open tasks.</p>}<Link href="/action-plan" className="panel-footer">View action plan <ArrowRight size={15}/></Link></section>
      <section className="insight-panel"><div className="insight-icon"><Sparkles size={19}/></div><div className="insight-kicker">RECORD-BASED ATTENTION</div><h3>What needs a look</h3><p>{attention}</p><Link href="/ai-assistant">Ask the assistant <ArrowRight size={15}/></Link></section>
      <section className="panel activity-panel"><div className="panel-heading"><div><h3>Recent records</h3><p>Harvest and expense entries</p></div><Clock3 size={18} className="muted-icon"/></div>{activity.length ? activity.map(item => <div className="activity" key={item.key}><span className="activity-dot"/><div><strong>{item.title}</strong><p>{item.detail}</p></div></div>) : <p className="section-empty">New harvest and expense records will appear here.</p>}</section>
    </div></div>
  </Shell>;
}
