"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Check, MapPinned, Plus, Settings2 } from "lucide-react";
import { Shell } from "@/components/shell";
import { useFarm } from "@/components/farm-provider";

export default function FarmSettingsPage() {
  const { farmId } = useFarm();
  return <FarmSettingsContent key={farmId ?? "local"}/>;
}

function FarmSettingsContent() {
  const { data, farmId, workspaces, hosted, busy, error, saveFarmProfile, createFarm, switchFarm } = useFarm();
  const [name, setName] = useState(data.farmName);
  const [location, setLocation] = useState(data.farmLocation === "Not set" ? "" : data.farmLocation);
  const [seasonYear, setSeasonYear] = useState(String(data.seasonYear));
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newSeasonYear, setNewSeasonYear] = useState(String(new Date().getFullYear()));
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    if (await saveFarmProfile({ name, location, seasonYear: Number(seasonYear) })) setSaved(true);
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    await createFarm({ name: newName, location: newLocation, seasonYear: Number(newSeasonYear) });
  }
  return <Shell>
    <section className="section-hero"><div className="section-icon"><Settings2 size={30}/></div><div><span className="eyebrow">FARM WORKSPACE</span><h2>Farm settings</h2><p>Keep your farm name, location, and season in sync across the dashboard and reports.</p></div></section>
    {hosted && <section className="records-panel"><div className="records-head"><div><h3>Your farm workspaces</h3><p>Choose which farm’s saved records appear throughout HarvestCompass.</p></div></div>
      <div className="workspace-list">{workspaces.map(workspace=><button key={workspace.id} type="button" className={`workspace-choice ${workspace.id===farmId?"selected":""}`} disabled={busy||workspace.id===farmId} onClick={()=>switchFarm(workspace.id)}><span><strong>{workspace.name}</strong><small>{workspace.demoSeeded?"Contains fictional demo seed records":"Your saved farm records"}</small></span>{workspace.id===farmId?<span className="workspace-current"><Check size={16}/> Current</span>:<span className="workspace-switch">Switch <ArrowRight size={15}/></span>}</button>)}</div>
    </section>}
    <section className="records-panel"><div className="records-head"><div><h3>Farm profile</h3><p>{hosted ? "Saved in Supabase" : "Saved in this browser"}</p></div></div>
      <form className="record-form" onSubmit={submit}>
        <label>Farm name<input required maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="Your farm name"/></label>
        <label>Location<input required maxLength={160} value={location} onChange={event => setLocation(event.target.value)} placeholder="City, state"/></label>
        <label>Farming season<input required type="number" min="2000" max="2100" value={seasonYear} onChange={event => setSeasonYear(event.target.value)}/></label>
        <div className="form-actions"><button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save farm profile"}</button></div>
      </form>
      {saved && <p className="record-success" role="status">Farm profile saved.</p>}{error && <p className="record-error" role="alert">{error}</p>}
      {data.demoSeeded && <p className="profile-note">This workspace began with fictional demo records. Add another farm below to start with your own records while keeping this demo available.</p>}
    </section>
    {hosted && <section className="records-panel"><div className="records-head"><div><h3>Add another farm</h3><p>Manage a separate farm with its own fields, equipment, and records. To add machinery to this farm, use Farm Operations.</p></div><Plus size={20}/></div>
      <form className="record-form" onSubmit={create}>
        <label>Farm name<input required maxLength={100} value={newName} onChange={event=>setNewName(event.target.value)} placeholder="Your farm name"/></label>
        <label>Location<input required maxLength={160} value={newLocation} onChange={event=>setNewLocation(event.target.value)} placeholder="Brookings, South Dakota"/></label>
        <label>Farming season<input required type="number" min="2000" max="2100" value={newSeasonYear} onChange={event=>setNewSeasonYear(event.target.value)}/></label>
        <div className="form-actions"><button className="primary-button" type="submit" disabled={busy}>{busy ? "Creating…" : "Add farm"}</button></div>
      </form>
    </section>}
    <div className="profile-links"><Link href="/farm-map"><MapPinned size={17}/> Select fields <ArrowRight size={15}/></Link></div>
    <details className="records-panel"><summary>Advanced setup</summary><p>For the person managing this app’s assistant connection and forecast integration.</p><Link className="text-link" href="/settings/ai">Connection and forecast setup <ArrowRight size={15}/></Link></details>
  </Shell>;
}
