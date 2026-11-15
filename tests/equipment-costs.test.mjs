import test from "node:test";
import assert from "node:assert/strict";
import { emptyTerms, equipmentDescription, equipmentEstimate, readEquipmentTerms, writeEquipmentTerms } from "../lib/equipment-terms.ts";

const planned=writeEquipmentTerms("Tractor",{...emptyTerms,access:"Rented",rate:"500",quantity:"2",unit:"day"});
test("planned agreements remain estimates until an actual ledger entry exists",()=>{
  assert.equal(equipmentEstimate(readEquipmentTerms(planned).terms),1000);
  assert.match(equipmentDescription(planned,[],"tractor-id"),/Planning estimate: \$1,000/);
});
test("actual cost and later corrections come from the expense ledger, not rental assumptions",()=>{
  const expenses=[{id:"tractor-id",amount:1250,date:"2027-10-02"}];
  assert.match(equipmentDescription(planned,expenses,"tractor-id"),/Recorded expense: \$1,250/);
  assert.doesNotMatch(equipmentDescription(planned,expenses,"tractor-id"),/Planning estimate/);
  expenses[0].amount=1300;
  assert.match(equipmentDescription(planned,expenses,"tractor-id"),/Recorded expense: \$1,300/);
});
test("linking an existing bill uses its amount without creating another ledger entry",()=>{
  const note=writeEquipmentTerms("Truck",{...emptyTerms,expenseId:"existing-bill"});
  const expenses=[{id:"existing-bill",amount:700,date:"2027-10-03"}];
  assert.match(equipmentDescription(note,expenses,"truck-id"),/Recorded expense: \$700/);
  assert.equal(expenses.length,1);
  assert.match(equipmentDescription(note,[],"truck-id"),/Linked expense is unavailable/);
});
test("legacy notes remain readable and do not become actual expenses automatically",()=>{
  assert.equal(readEquipmentTerms("Available at main shed").terms.expenseId,"");
  assert.equal(equipmentDescription("Available at main shed",[],"old-id"),"Available at main shed");
});
