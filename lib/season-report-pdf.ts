import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { FarmState } from "./farm-store";
import { equipmentDescription } from "./equipment-terms.ts";
export type ReportAdvice={summary?:string;recommendations:{title:string;observation:string;action:string}[];generatedAt?:string;unavailable?:string};
const money=(n:number)=>n.toLocaleString("en-US",{style:"currency",currency:"USD"});
const num=(n:number)=>n.toLocaleString("en-US",{maximumFractionDigits:2});
const clean=(v:unknown)=>String(v??"").replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,"-").replace(/[^\x09\x0a\x0d\x20-\x7e]/g," ");
const colors:[number,number,number][]=[[54,122,88],[66,142,173],[207,121,75],[136,129,184]];
export function downloadSeasonReport(data:FarmState,insights:ReportAdvice){
 const doc=new jsPDF({unit:"mm",format:"a4"});let y=22;
 const pageBackground=()=>{doc.setFillColor(255,255,255);doc.rect(0,0,210,297,"F");};
 pageBackground();doc.internal.events.subscribe("addPage",pageBackground);
 const ensure=(h:number)=>{if(y+h>273){doc.addPage();y=26;}};
 const text=(value:string,size=10,bold=false)=>{doc.setFont("helvetica",bold?"bold":"normal");doc.setFontSize(size);doc.setTextColor(48,65,54);for(const line of doc.splitTextToSize(clean(value),174) as string[]){ensure(6);doc.text(line,18,y);y+=size*.48;}y+=3;};
 const heading=(label:string)=>{ensure(30);y+=5;doc.setDrawColor(211,222,210);doc.line(18,y,192,y);y+=8;text(label,12,true);y+=1;};
 const table=(head:string[],body:(string|number)[][])=>{if(!body.length)return;ensure(26);autoTable(doc,{startY:y,head:[head],body:body.map(row=>row.map(clean)),margin:{top:26,left:18,right:18,bottom:23},theme:"plain",styles:{font:"helvetica",fontSize:8.5,cellPadding:3.2,overflow:"linebreak",textColor:[50,65,55],lineColor:[229,235,226],lineWidth:{bottom:.15}},headStyles:{fillColor:[237,242,234],textColor:[34,93,65],fontStyle:"bold"},alternateRowStyles:{fillColor:[249,250,247]},rowPageBreak:"avoid"});y=(doc as jsPDF&{lastAutoTable:{finalY:number}}).lastAutoTable.finalY+7;};
 const acres=data.fields.reduce((s,f)=>s+f.acres,0),expenses=data.expenses.reduce((s,e)=>s+e.amount,0);
 const pending=data.tasks.filter(t=>!t.done),completed=data.tasks.filter(t=>t.done);
 doc.setFillColor(26,62,44);doc.rect(0,0,210,50,"F");doc.setFont("helvetica","bold");doc.setTextColor(255,255,255);doc.setFontSize(11);doc.text("HARVESTCOMPASS",18,15);doc.setFontSize(22);doc.text("Farm management report",18,28);doc.setFont("helvetica","normal");doc.setFontSize(10);doc.setTextColor(208,226,210);doc.text(data.seasonYear+" SEASON | Prepared "+new Date().toLocaleDateString("en-US"),18,39);
 y=63;text(data.farmName,17,true);text(data.farmLocation&&data.farmLocation!=="Not set"?data.farmLocation:"Location not specified");
 if(data.demoSeeded)text("DEMONSTRATION - fictional farm records",9,true);
 const cardY=y;
 [["LAND AREA",num(acres)+" acres"],["FIELDS",String(data.fields.length)],["EXPENSES ENTERED",money(expenses)],["OPEN TASKS",String(pending.length)]].forEach(([label,value],i)=>{const x=18+i*44.5;doc.setFillColor(242,246,238);doc.roundedRect(x,cardY,40.5,23,2,2,"F");doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(106,124,108);doc.text(label,x+3,cardY+7);doc.setFont("helvetica","bold");doc.setFontSize(value.length>13?10:13);doc.setTextColor(34,93,65);doc.text(value,x+3,cardY+16);});y+=33;
 text("Reporting basis: current workspace records, including entries dated outside the selected season. Figures are farmer-entered.",8);
 const bars=(title:string,items:{label:string;value:number;formatted:string}[])=>{if(!items.length)return;heading(title);const total=items.reduce((s,i)=>s+i.value,0);for(const [i,item] of items.entries()){ensure(18);doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(48,65,54);doc.text(clean(item.label),18,y);doc.setFont("helvetica","bold");doc.text(item.formatted+" | "+(total?Math.round(item.value/total*100):0)+"%",192,y,{align:"right"});y+=4;doc.setFillColor(237,241,233);doc.roundedRect(18,y,174,4,1,1,"F");if(item.value>0&&total>0){doc.setFillColor(...colors[i%colors.length]);doc.roundedRect(18,y,Math.max(1,174*item.value/total),4,1,1,"F");}y+=11;}};
 const groups=new Map<string,number>();for(const e of data.expenses)groups.set(e.category,(groups.get(e.category)??0)+e.amount);
 bars("Expense allocation",Array.from(groups,([label,value])=>({label,value,formatted:money(value)})).filter(i=>i.value>0).sort((a,b)=>b.value-a.value));
 const crops=(["Corn","Soybeans"] as const).map(crop=>({label:crop,value:data.fields.filter(f=>f.crop===crop).reduce((s,f)=>s+f.acres,0)})).filter(i=>i.value>0);
 bars("Cropping footprint",crops.map(i=>({...i,formatted:num(i.value)+" acres"})));
 if(data.fields.length){heading("Field register");table(["Field / crop","Acres","Planting","Status","Progress"],data.fields.map(f=>[f.name+"\n"+f.crop,num(f.acres),f.planted&&f.planted!=="Not set"?(f.status==="Planned"?"Planned\n":"")+f.planted:"-",f.status,f.progress+"%"]));text("Progress is farmer-entered. Mapped acreage may use estimated agricultural boundaries.",8);}
 if(pending.length){heading("Work priorities");table(["Task","Due","Priority","Details"],pending.map(t=>[t.title,t.due||"-",t.priority,t.detail]));}
 if(completed.length){heading("Completed work");table(["Task","Due","Details"],completed.map(t=>[t.title,t.due||"-",t.detail]));}
 if(data.expenses.length){heading("Expense ledger");table(["Date","Category","Description","Amount"],data.expenses.map(e=>[e.date,e.category,e.note,money(e.amount)]));text("Total expenses entered: "+money(expenses),11,true);}
 if(data.equipment.length){heading("Equipment commitments");table(["Equipment","Availability","Agreement"],data.equipment.map(e=>[e.name,e.status,equipmentDescription(e.note)]));text("Planning estimates are excluded from expenses unless separately entered in the expense ledger.",8);}
 if(data.harvestEntries.length){heading("Harvest ledger");table(["Date / field","Bushels","Moisture","Storage"],data.harvestEntries.map(h=>[h.harvestedOn+"\n"+(data.fields.find(f=>f.id===h.fieldId)?.name||"-"),num(h.bushels),h.moisturePercent===null?"-":h.moisturePercent+"%",h.storageBin]));}
 if(data.grainSales.length){heading("Grain sales");table(["Date / buyer","Crop","Bushels","Price / bu","Revenue"],data.grainSales.map(s=>[s.soldOn+"\n"+(s.buyer||"-"),s.crop,num(s.bushels),money(s.pricePerBushel),money(s.bushels*s.pricePerBushel)]));text("Recorded grain revenue: "+money(data.grainSales.reduce((sum,s)=>sum+s.bushels*s.pricePerBushel,0)),11,true);}
 if(insights.summary||insights.recommendations.length){heading("Management assessment");text("AI-assisted review | "+new Date(insights.generatedAt||Date.now()).toLocaleDateString("en-US"),8);if(insights.summary)text(insights.summary);for(const [i,item] of insights.recommendations.entries()){ensure(35);text((i+1)+". "+item.title,11,true);text(item.observation);text("Recommended action: "+item.action);}text("Prepared from current farm records for decision support. Recommendations require farmer review; no plan changes were made.",8);}
 heading("Report coverage");
 const absent=[!data.harvestEntries.length?"harvest entries":"",!data.grainSales.length?"grain sales":"",!data.expenses.length?"expenses":"",!data.tasks.length?"tasks":""].filter(Boolean);
 text(absent.length?"Not included: "+absent.join(", ")+" were not entered at the time of reporting.":"Includes the farm's entered fields, tasks, expenses, harvest and sales.",8);
 if(insights.unavailable)text("AI assessment unavailable for this export. Operational and financial figures are included as entered.",8);
 const pages=doc.getNumberOfPages();for(let page=1;page<=pages;page++){doc.setPage(page);if(page>1){doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(34,93,65);doc.text("HARVESTCOMPASS",18,14);doc.setFont("helvetica","normal");doc.text(data.seasonYear+" | Farm management report",192,14,{align:"right"});}doc.setDrawColor(217,227,214);doc.line(18,282,192,282);doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(106,121,109);doc.text(clean(data.farmName).slice(0,75),18,289);doc.text(page+" / "+pages,192,289,{align:"right"});}
 doc.save("HarvestCompass-"+data.seasonYear+"-"+data.farmName.replace(/[^a-z0-9]+/gi,"-")+".pdf");
}
