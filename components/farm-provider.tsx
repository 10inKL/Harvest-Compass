"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { initialFarmState, type FarmState } from "@/lib/farm-store";
const STORAGE_KEY = "harvestcompass-farm-v1";
const Context = createContext<{ data: FarmState; setData: React.Dispatch<React.SetStateAction<FarmState>>; ready: boolean } | null>(null);
export function FarmProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<FarmState>(initialFarmState);
  const [ready, setReady] = useState(false);
  useEffect(() => { try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) queueMicrotask(() => setData(JSON.parse(saved) as FarmState)); } catch { /* use demo seed */ } queueMicrotask(() => setReady(true)); }, []);
  useEffect(() => { if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data, ready]);
  return <Context.Provider value={{ data, setData, ready }}>{children}</Context.Provider>;
}
export function useFarm() { const value = useContext(Context); if (!value) throw new Error("FarmProvider is missing"); return value; }
