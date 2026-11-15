"use client";
import { useCallback, useEffect, useState } from "react";
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, LoaderCircle, MapPin, Moon, RefreshCw, Sun, Wind } from "lucide-react";
import { useFarm } from "./farm-provider";
import { supabase } from "@/lib/supabase-client";
import type { FarmWeather } from "@/lib/weather";
import { ForecastLocationPicker } from "./forecast-location-picker";
import { fahrenheit } from "@/lib/weather";
import styles from "./farm-weather.module.css";

function WeatherIcon({description,size=28,night=false}:{description:string;size?:number;night?:boolean}){
  const value=description.toLowerCase();const Icon=/thunder|storm/.test(value)?CloudLightning:/snow|sleet|ice|freezing/.test(value)?CloudSnow:/rain|shower|drizzle/.test(value)?CloudRain:/fog|haze|mist/.test(value)?CloudFog:/partly|mostly sunny|mostly clear/.test(value)?CloudSun:/cloud|overcast/.test(value)?Cloud:night?Moon:Sun;
  return <Icon size={size} strokeWidth={1.6} aria-hidden="true"/>;
}
const temperature=(value:number|null)=>value===null?"—":Math.round(value)+"°";
export function FarmWeatherPanel({embedded=false}:{embedded?:boolean}){const {farmId}=useFarm();return <WeatherPanel key={farmId||"local"} embedded={embedded}/>;}
function WeatherPanel({embedded=false}:{embedded?:boolean}={}){
  const {data,hosted}=useFarm();
  const [weather,setWeather]=useState<FarmWeather|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [needsLocation,setNeedsLocation]=useState(false),[fieldId,setFieldId]=useState(""),[revision,setRevision]=useState(0),[selected,setSelected]=useState(0);
  const [editingLocation,setEditingLocation]=useState(false);
  const authFetch=useCallback(async(url:string,options?:RequestInit)=>{const token=(await supabase?.auth.getSession())?.data.session?.access_token;return fetch(url,{...options,headers:{...options?.headers,...(token?{Authorization:`Bearer ${token}`}:{})},cache:"no-store"});},[]);
  useEffect(()=>{
    const controller=new AbortController();
    void(async()=>{
      setLoading(true);setError("");setWeather(null);setSelected(0);
      if(!hosted){setNeedsLocation(true);setLoading(false);return;}
      try{const response=await authFetch("/api/weather"+(fieldId?"?fieldId="+encodeURIComponent(fieldId):""),{signal:controller.signal});const result=await response.json();if(controller.signal.aborted)return;if(!response.ok)throw new Error(result.error||"Weather is unavailable.");setNeedsLocation(!!result.needsLocation);if(!result.needsLocation)setWeather(result);}
      catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Weather could not be loaded.");}
      finally{if(!controller.signal.aborted)setLoading(false);}
    })();
    return()=>controller.abort();
  },[authFetch,fieldId,revision,hosted]);
  useEffect(()=>{const timer=setInterval(()=>{if(document.visibilityState==="visible")setRevision(value=>value+1);},15*60*1000);return()=>clearInterval(timer);},[]);
  const day=weather?.days[selected],isToday=selected===0&&day?.label==="Today",observed=isToday?weather?.current:null;
  const period=day?.periods.find(p=>p.isDaytime)??day?.periods[0];
  const clock=(date:string)=>new Date(date).toLocaleTimeString("en-US",{timeZone:weather?.timeZone,hour:"numeric",minute:"2-digit",timeZoneName:"short"});
  return <section className={[styles.panel,embedded?styles.embedded:""].join(" ")} aria-label="Farm weather forecast">
    <header className={styles.header}><div><div className={styles.eyebrow}>WEATHER AT YOUR FARM</div><div className={styles.title}><MapPin size={16}/><h2>{weather?.location.name||data.farmLocation||"Local forecast"}</h2></div><p>{weather?.location.basis||"Today and the week ahead"}</p></div><div className={styles.controls}>{data.fields.some(f=>f.boundaryConfirmed&&f.boundaryGeoJson)&&<select aria-label="Weather forecast location" value={fieldId} onChange={e=>setFieldId(e.target.value)}><option value="">Farm forecast</option>{data.fields.filter(f=>f.boundaryConfirmed&&f.boundaryGeoJson).map(f=><option value={f.id} key={f.id}>{f.name}</option>)}</select>}<button type="button" onClick={()=>setEditingLocation(value=>!value)} disabled={!hosted} className={styles.locationButton}>Change town</button><button type="button" className={styles.refresh} aria-label="Refresh weather" onClick={()=>setRevision(value=>value+1)} disabled={loading}><RefreshCw size={15} className={loading?styles.spinning:""}/></button></div></header>
    {editingLocation&&<ForecastLocationPicker fields={data.fields} authFetch={authFetch} disabled={!hosted} onClose={()=>setEditingLocation(false)} onSaved={()=>{setFieldId("");setEditingLocation(false);setRevision(value=>value+1);}}/>}
    {loading?<div className={styles.loading} role="status"><LoaderCircle size={25} className={styles.spinning}/><span>Checking your local forecast…</span><div className={styles.skeleton}/></div>:error?<div className={styles.empty}><CloudSun size={38}/><h3>Forecast temporarily unavailable</h3><p role="alert">{error}</p><button type="button" onClick={()=>setRevision(value=>value+1)}>Try again</button></div>:needsLocation?<div className={styles.empty}><MapPin size={35}/><h3>A local outlook starts with your location.</h3><p>{hosted?"Choose a town above, or save your field on Farm Map. We’ll use its location for the forecast.":"Sign in to see weather for your own farm. Demo weather is not substituted."}</p>{hosted&&<button type="button" onClick={()=>setEditingLocation(true)}>Choose a town</button>}</div>:weather&&day&&<>
      <div className={styles.body}><div className={styles.current}><span className={styles.currentLabel}>{observed?"LATEST OBSERVATION":isToday?"TODAY’S FORECAST":day.label.toUpperCase()+" · FORECAST"}</span><div className={styles.currentTemp}><span className={styles.heroIcon}><WeatherIcon description={observed?.description||period?.shortForecast||day.summary} size={56} night={!observed&&!period?.isDaytime}/></span><strong>{temperature(observed?.temperature??(period?fahrenheit(period.temperature,period.temperatureUnit):null))}<small>F</small></strong></div><h3>{observed?.description||day.summary}</h3><div className={styles.conditions}><span><Wind size={15}/>{observed?(observed.wind||"Wind unavailable"):((period?.windSpeed||"—")+" "+(period?.windDirection||""))}</span><span><Droplets size={15}/>{day.rainChance===null?"Chance unavailable":day.rainChance+"% precip. chance"}</span></div>{observed?<p className={styles.observedAt}>Observed {clock(observed.observedAt)}<br/>{observed.station}</p>:<p className={styles.observedAt}>Forecast period: {period?.name}<br/>Actual station conditions unavailable{!isToday?" for this future date":""}.</p>}</div>
      <div className={styles.outlook}><div className={styles.outlookHeading}><h3>7-day outlook</h3><span>High / low · °F</span></div><div className={styles.days}>{weather.days.map((item,i)=><button className={[styles.day,selected===i?styles.selected:""].join(" ")} type="button" key={item.date} onClick={()=>setSelected(i)} aria-pressed={selected===i} aria-label={item.label+": "+item.summary+", high "+(item.high??"unavailable")+", low "+(item.low??"unavailable")}><strong>{item.label}</strong><small>{new Date(item.periods[0].startTime).toLocaleDateString("en-US",{timeZone:weather.timeZone,month:"short",day:"numeric"})}</small><span className={styles.dayIcon}><WeatherIcon description={item.summary} night={!item.periods.some(p=>p.isDaytime)}/></span><span className={styles.dayTemps}>{temperature(item.high)} <em>{temperature(item.low)}</em></span><span className={styles.dayRain}><Droplets size={11}/>{item.rainChance===null?"—":item.rainChance+"%"}</span></button>)}</div><p className={styles.scrollHint}>Swipe to see the rest of the week →</p><div className={styles.detail} aria-live="polite"><div><strong>{day.label} · forecast details</strong><span>Peak period precipitation chance shown above</span></div>{day.periods.map(p=><p key={p.startTime}><b>{p.name}:</b> {p.detailedForecast}</p>)}</div></div></div>
      <footer className={styles.footer}><a href={weather.forecastUrl} target="_blank" rel="noreferrer">NOAA · National Weather Service ↗</a><span>Retrieved {clock(weather.retrievedAt)}{weather.issuedAt?" · Issued "+clock(weather.issuedAt):""}</span><small>Times are local to this forecast. Missing values show —. Forecasts do not confirm field access or harvest readiness.</small></footer>
    </>}
  </section>;
}
