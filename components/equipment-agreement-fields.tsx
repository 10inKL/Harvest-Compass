"use client";
import { emptyTerms, equipmentEstimate } from "@/lib/equipment-terms";

const units = ["hour", "day", "week", "month", "acre", "season", "fixed agreement"];
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
export function EquipmentAgreementFields({ form, update }: { form: Record<string, string>; update: (key: string, value: string) => void }) {
  const unit = form.unit || "hour";
  const fixed = unit === "fixed agreement";
  const quantityLabel = fixed ? "" : unit === "acre" ? "How many acres will it cover?" : `How many ${unit}s will you use it?`;
  const estimate = equipmentEstimate({ ...emptyTerms, ...form, quantity: fixed ? "1" : form.quantity || "" });
  return <>
    <label>Do you own or rent this equipment?<select value={form.access??"Unknown"} onChange={e=>update("access",e.target.value)}><option value="Unknown">Select an option</option><option>Owned</option><option>Rented</option><option>Leased</option><option>Custom hired (with operator)</option><option>Borrowed / shared</option></select></label>
    <label>Who provides it? (optional)<input value={form.provider??""} onChange={e=>update("provider",e.target.value)} placeholder="Dealer, owner, or custom operator"/></label>
    <label>How are you charged?<select value={unit} onChange={e=>{update("unit",e.target.value);if(e.target.value==="fixed agreement")update("quantity","1");else if(fixed)update("quantity","");}}>{units.map(value=><option key={value} value={value}>{value==="fixed agreement"?"One total price for the whole agreement":`Per ${value}`}</option>)}</select></label>
    <label>{fixed?"Total agreed price ($)":`Price per ${unit} ($)`}<input type="number" min="0" step="0.01" value={form.rate??""} onChange={e=>update("rate",e.target.value)} placeholder={fixed?"e.g. 500 total":"e.g. 500"}/></label>
    {!fixed&&<label>{quantityLabel}<input type="number" min="0.01" step="0.01" value={form.quantity??""} onChange={e=>update("quantity",e.target.value)} placeholder={unit==="day"?"e.g. 5 for five days":"Enter expected usage"}/></label>}
    <label>What does the price include? (optional)<input value={form.inclusions??""} onChange={e=>update("inclusions",e.target.value)} placeholder="e.g. operator included; fuel charged separately"/><small>Notes only. Extra charges are not added automatically.</small></label>
    <div style={{gridColumn:"1 / -1"}} role="status"><strong>{estimate===null?"Estimated equipment cost: enter a price and usage to calculate.":`Estimated equipment cost: ${money(estimate)}`}</strong>{estimate!==null&&<p>{fixed?`One agreed total of ${money(Number(form.rate))}.`:`${form.quantity} ${unit}${Number(form.quantity)===1?"":"s"} × ${money(Number(form.rate))} per ${unit} = ${money(estimate)}`}</p>}<p>Use the price you agreed with the provider. If $500 covers all five days, choose “One total price”; if it is $500 each day, choose “Per day” and enter 5 days.</p><small>This is a planning estimate. Record the actual bill in Reports → Expenses when available.</small></div>
  </>;
}
