import { farm, tasks, expenses, type Field } from "./demo-data";
export interface FarmTask { id: string; title: string; detail: string; due: string; priority: "High" | "Medium" | "Low"; done: boolean; }
export interface Expense { id: string; category: "Seed" | "Fertilizer" | "Fuel & equipment" | "Labor & other"; amount: number; date: string; note: string; }
export interface Equipment { id: string; name: string; status: "Ready" | "Needs service" | "In use"; note: string; }
export interface HarvestEntry { id: string; fieldId: string; harvestedOn: string; bushels: number; moisturePercent: number | null; storageBin: string; notes: string; }
export interface GrainSale { id: string; crop: "Corn" | "Soybeans"; storageBin: string; soldOn: string; bushels: number; pricePerBushel: number; buyer: string; notes: string; }
export interface FarmState { farmName: string; farmLocation: string; seasonYear: number; demoSeeded: boolean; fields: Field[]; tasks: FarmTask[]; expenses: Expense[]; equipment: Equipment[]; harvestEntries: HarvestEntry[]; grainSales: GrainSale[]; }
export const initialFarmState: FarmState = {
  farmName: farm.name, farmLocation: farm.location, seasonYear: 2026, demoSeeded: true, fields: farm.fields,
  tasks: tasks.map((t,i) => ({ id: `task-${i}`, title: t.title, detail: t.detail, due: t.date, priority: t.priority as FarmTask["priority"], done: false })),
  expenses: expenses.map((e,i) => ({ id: `expense-${i}`, category: e.name as Expense["category"], amount: e.value, date: "2026-08-01", note: "Demo season estimate" })),
  harvestEntries: [],
  grainSales: [],
  equipment: [{ id: "combine", name: "John Deere S780 combine", status: "Needs service", note: "Pre-harvest maintenance due" }, { id: "tractor", name: "John Deere 8R tractor", status: "Ready", note: "Available for field work" }],
};
export const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
