"use client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useFarm } from "./farm-provider";
const palette: Record<string,string> = {Seed:"#367A58",Fertilizer:"#8881B8","Fuel & equipment":"#CF794B","Labor & other":"#428EAD"};
const currency=(value:number)=>value.toLocaleString("en-US",{style:"currency",currency:"USD",minimumFractionDigits:0,maximumFractionDigits:2});
export function ExpenseChart(){
  const {data}=useFarm();
  const groups=new Map<string,number>();
  for(const item of data.expenses)groups.set(item.category,(groups.get(item.category)??0)+item.amount);
  const expenses=Array.from(groups,([name,value])=>({name,value,color:palette[name]??"#73816D"})).filter(item=>item.value>0).sort((a,b)=>b.value-a.value);
  const total=expenses.reduce((sum,item)=>sum+item.value,0);
  if(!total)return <p style={{color:"var(--muted)",fontSize:13}}>Add your first expense to see where your money goes.</p>;
  return <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:28,padding:"8px 0"}}>
    <div style={{position:"relative",width:190,height:190,flex:"0 0 190px",margin:"auto"}}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expenses} dataKey="value" nameKey="name" innerRadius="73%" outerRadius="94%" paddingAngle={expenses.length>1?3:0} stroke="none">{expenses.map(item=><Cell key={item.name} fill={item.color}/>)}</Pie><Tooltip formatter={value=>currency(Number(value))}/></PieChart></ResponsiveContainer><div className="chart-center"><strong style={{fontSize:22}}>{currency(total)}</strong><small>Total recorded</small></div></div>
    <div style={{flex:"1 1 220px",minWidth:0,maxWidth:640}}>{expenses.map(item=><div key={item.name} style={{padding:"12px 0",borderBottom:"1px solid #eff1ec"}}><div style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}><span style={{width:9,height:9,borderRadius:3,background:item.color,flexShrink:0}}/><span style={{fontWeight:600}}>{item.name}</span><small style={{marginLeft:"auto",color:"#7e8980"}}>{(item.value/total*100).toFixed(1)}%</small><strong style={{minWidth:65,textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{currency(item.value)}</strong></div><div style={{height:4,background:"#f0f2ec",borderRadius:5,margin:"10px 0 0 17px",overflow:"hidden"}}><span style={{display:"block",height:"100%",width:`${item.value/total*100}%`,background:item.color,borderRadius:5}}/></div></div>)}<p style={{fontSize:10,color:"#7f8b81",lineHeight:1.6,marginTop:14}}>Based on {data.expenses.length} saved expense {data.expenses.length===1?"entry":"entries"}. Equipment estimates are excluded.</p></div>
  </div>;
}
