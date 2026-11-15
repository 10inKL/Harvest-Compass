"use client";
import { emptyTerms, equipmentEstimate } from "@/lib/equipment-terms";
import { useFarm } from "./farm-provider";

const units = ["hour", "day", "week", "month", "acre", "season", "fixed agreement"];
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
export function EquipmentAgreementFields({ form, update }: { form: Record<string, string>; update: (key: string, value: string) => void }) {
  const {data}=useFarm();
  const costMode=form.costMode||"planned";
  const linkedExpense=data.expenses.find(expense=>expense.id===form.expenseId);
  const unit = form.unit || "hour";
  const fixed = unit === "fixed agreement";
  const quantityLabel = fixed ? "" : unit === "acre" ? "How many acres will it cover?" : `How many ${unit}s will you use it?`;
  const estimate = equipmentEstimate({ ...emptyTerms, ...form, quantity: fixed ? "1" : form.quantity || "" });
  return <>
    <label>Is this cost planned or already incurred?<select value={costMode} onChange={e=>update("costMode",e.target.value)}><option value="planned">Planning only — do not add to expenses</option><option value="record">Record an actual bill / cost</option><option value="existing">Already entered in Expenses — link it</option></select></label>
    {costMode==="record"&&<><label>Actual bill amount ($)<input required type="number" min="0.01" step="0.01" value={form.actualAmount||""} onChange={e=>update("actualAmount",e.target.value)} placeholder="Enter the final amount, including extra charges"/></label><label>Expense date<input required type="date" value={form.actualDate||""} onChange={e=>update("actualDate",e.target.value)}/></label><p style={{gridColumn:"1 / -1",fontSize:12}}>Saving records this amount once under Fuel &amp; equipment. Do not add the same bill again in Reports.</p></>}
    {costMode==="existing"&&<><label>Select the expense already recorded<select required value={form.expenseId||""} onChange={e=>update("expenseId",e.target.value)}><option value="">Choose an existing expense</option>{data.expenses.map(expense=><option key={expense.id} value={expense.id}>{expense.date} · {money(expense.amount)} · {expense.note||expense.category}</option>)}</select></label>{linkedExpense&&<p style={{fontSize:12}}>Recorded cost: {money(linkedExpense.amount)}. Already included in expense totals; it will not be added again. Edit the bill in Reports if needed.</p>}</>}
    <label>Do you own or rent this equipment?<select value={form.access??"Unknown"} onChange={e=>update("access",e.target.value)}><option value="Unknown">Select an option</option><option>Owned</option><option>Rented</option><option>Leased</option><option>Custom hired (with operator)</option><option>Borrowed / shared</option></select></label>
    <label>Who provides it? (optional)<input value={form.provider??""} onChange={e=>update("provider",e.target.value)} placeholder="Dealer, owner, or custom operator"/></label>
    {costMode==="planned"&&<><label>How are you charged?<select value={unit} onChange={e=>{update("unit",e.target.value);if(e.target.value==="fixed agreement")update("quantity","1");else if(fixed)update("quantity","");}}>{units.map(value=><option key={value} value={value}>{value==="fixed agreement"?"One total price for the whole agreement":`Per ${value}`}</option>)}</select></label>
    <label>{fixed?"Total agreed price ($)":`Price per ${unit} ($)`}<input type="number" min="0" step="0.01" value={form.rate??""} onChange={e=>update("rate",e.target.value)} placeholder={fixed?"e.g. 500 total":"e.g. 500"}/></label>
    {!fixed&&<label>{quantityLabel}<input type="number" min="0.01" step="0.01" value={form.quantity??""} onChange={e=>update("quantity",e.target.value)} placeholder={unit==="day"?"e.g. 5 for five days":"Enter expected usage"}/></label>}
    <label>What does the price include? (optional)<input value={form.inclusions??""} onChange={e=>update("inclusions",e.target.value)} placeholder="e.g. operator included; fuel charged separately"/><small>Notes only. Extra charges are not added automatically.</small></label>
    <div style={{gridColumn:"1 / -1"}} role="status"><strong>{estimate===null?"Estimated equipment cost: enter a price and usage to calculate.":`Estimated equipment cost: ${money(estimate)}`}</strong>{estimate!==null&&<p>{fixed?`One agreed total of ${money(Number(form.rate))}.`:`${form.quantity} ${unit}${Number(form.quantity)===1?"":"s"} × ${money(Number(form.rate))} per ${unit} = ${money(estimate)}`}</p>}<p>Use the price you agreed with the provider. If $500 covers all five days, choose “One total price”; if it is $500 each day, choose “Per day” and enter 5 days.</p><small>This is a planning estimate. Record the actual bill in Reports → Expenses when available.</small></div>
    </>}
  </>;
}
