"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { MapPinned, Search, X } from "lucide-react";
import type { Field } from "@/lib/demo-data";
import { fieldWeatherPoint } from "@/lib/weather";
import styles from "./farm-weather.module.css";

type Place={label:string;latitude:number;longitude:number};
type Props={fields:Field[];disabled?:boolean;authFetch:(url:string,options?:RequestInit)=>Promise<Response>;onSaved:(label:string)=>void;onClose?:()=>void};
export function ForecastLocationPicker({fields,disabled=false,authFetch,onSaved,onClose}:Props){
  const [query,setQuery]=useState(""),[places,setPlaces]=useState<Place[]>([]),[searching,setSearching]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(""),[fieldId,setFieldId]=useState("");
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const mapped=fields.filter(field=>field.boundaryConfirmed&&fieldWeatherPoint(field.boundaryGeoJson));
  async function search(event:FormEvent){
    event.preventDefault();if(disabled||saving)return;
    controller.current?.abort();const request=new AbortController();controller.current=request;
    setSearching(true);setError("");setPlaces([]);
    try{const response=await authFetch("/api/map/search?q="+encodeURIComponent(query.trim()),{signal:request.signal});const result=await response.json();if(request.signal.aborted)return;if(!response.ok||result.error)throw new Error(result.error||"Location search is unavailable.");setPlaces(result.results??[]);if(!result.results?.length)setError("No locations found. Try a city and state or ZIP code.");}
    catch(error){if(!request.signal.aborted)setError(error instanceof Error?error.message:"Search is unavailable.");}
    finally{if(!request.signal.aborted)setSearching(false);}
  }
  async function save(place:Place){
    if(disabled||saving)return;
    controller.current?.abort();const request=new AbortController();controller.current=request;
    setSaving(true);setSearching(false);setError("");
    try{const response=await authFetch("/api/assistant/location",{method:"PATCH",signal:request.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({latitude:place.latitude,longitude:place.longitude})});const result=await response.json();if(request.signal.aborted)return;if(!response.ok||!result.saved)throw new Error(result.error||"Location could not be saved.");setPlaces([]);setQuery("");onSaved(place.label);}
    catch(error){if(!request.signal.aborted)setError(error instanceof Error?error.message:"Location could not be saved.");}
    finally{if(!request.signal.aborted)setSaving(false);}
  }
  function saveField(){const field=mapped.find(item=>item.id===fieldId),point=fieldWeatherPoint(field?.boundaryGeoJson);if(field&&point)void save({label:field.name,latitude:point[0],longitude:point[1]});}
  return <div className={styles.locationEditor}><div className={styles.editorHeading}><strong>Choose your forecast location</strong>{onClose&&<button type="button" aria-label="Close location search" onClick={onClose} disabled={saving}><X size={16}/></button>}</div><p>Search for a town, address or ZIP code. No coordinates needed.</p>
    <form onSubmit={search}><Search size={16}/><input aria-label="Weather town, address, or ZIP code" value={query} onChange={event=>{setQuery(event.target.value);setPlaces([]);controller.current?.abort();setSearching(false);}} placeholder="e.g. Madison, SD or 57042" required minLength={3} maxLength={120} disabled={disabled||saving}/><button type="submit" disabled={disabled||searching||saving}>{searching?"Searching…":"Search"}</button></form>
    {places.map((place,index)=><button type="button" key={place.label+index} disabled={saving||disabled} className={styles.place} onClick={()=>void save(place)}>{place.label}<span>{saving?"Saving…":"Use location"}</span></button>)}
    {mapped.length>0&&<div className={styles.fieldChoice}><label htmlFor="forecast-saved-field"><MapPinned size={14}/> Or use one of your mapped fields</label><div><select id="forecast-saved-field" value={fieldId} disabled={disabled||saving} onChange={event=>setFieldId(event.target.value)}><option value="">Choose a field</option>{mapped.map(field=><option key={field.id} value={field.id}>{field.name}</option>)}</select><button type="button" disabled={disabled||saving||!fieldId} onClick={saveField}>{saving?"Saving…":"Use field"}</button></div></div>}
    {error&&<p className={styles.error} role="alert">{error}</p>}{disabled&&<p>Sign in to save your forecast location.</p>}
  </div>;
}
