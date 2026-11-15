import { forecastDays, type FarmWeather, type ForecastPeriod } from "./weather.ts";
const origin="https://api.weather.gov/";
export async function nwsJson<T>(url:string):Promise<T>{
  if(!url.startsWith(origin))throw new Error("Invalid weather source");
  const response=await fetch(url,{headers:{"User-Agent":"HarvestCompass/1.0 (https://github.com/10inKL/Harvest-Compass)",Accept:"application/geo+json"},signal:AbortSignal.timeout(10000),next:{revalidate:600}});
  if(!response.ok)throw new Error("Weather service unavailable");return response.json();
}
async function observation(url:string):Promise<FarmWeather["current"]>{
  try{
    const stations=await nwsJson<{features?:{id:string;properties?:{name?:string}}[]}>(url);
    for(const station of (stations.features??[]).slice(0,2)){
      try{
        const result=await nwsJson<{properties:{timestamp:string;temperature:{value:number|null};textDescription:string;windSpeed:{value:number|null;unitCode:string};windDirection:{value:number|null};relativeHumidity:{value:number|null}}}>(station.id+"/observations/latest");
        const p=result.properties,age=Date.now()-Date.parse(p.timestamp);
        if(typeof p.temperature.value!=="number"||!Number.isFinite(p.temperature.value)||!Number.isFinite(age)||age>3*60*60*1000||age< -10*60*1000)continue;
        const speed=p.windSpeed?.value;let mph:number|null=null;
        if(typeof speed==="number"&&Number.isFinite(speed)){if(p.windSpeed.unitCode==="wmoUnit:km_h-1")mph=speed*.621371;else if(p.windSpeed.unitCode==="wmoUnit:m_s-1")mph=speed*2.23694;}
        const direction=p.windDirection?.value;const compass=typeof direction==="number"?["N","NE","E","SE","S","SW","W","NW"][Math.round(direction/45)%8]:"";
        return {temperature:Math.round(p.temperature.value*9/5+32),description:p.textDescription||"Latest station observation",wind:mph===null?null:Math.round(mph)+" mph "+compass,humidity:p.relativeHumidity?.value??null,observedAt:p.timestamp,station:station.properties?.name||"Nearby weather station",source:station.id+"/observations/latest"};
      }catch{continue;}
    }
  }catch{}
  return null;
}
export async function getNwsWeather(location:FarmWeather["location"]):Promise<FarmWeather>{
  const point=await nwsJson<{properties:{forecast:string;observationStations?:string;timeZone:string;relativeLocation?:{properties?:{city?:string;state?:string}}}}>(origin+"points/"+location.latitude.toFixed(4)+","+location.longitude.toFixed(4));
  const p=point.properties;
  const [forecast,current]=await Promise.all([nwsJson<{properties:{updated?:string;updateTime?:string;generatedAt?:string;periods:ForecastPeriod[]}}>(p.forecast),p.observationStations?observation(p.observationStations):Promise.resolve(null)]);
  const days=forecastDays(forecast.properties.periods??[],p.timeZone);
  if(!days.length)throw new Error("No forecast available");
  const nearby=p.relativeLocation?.properties;
  const resolved=nearby?.city?{...location,name:"Near "+nearby.city+(nearby.state?", "+nearby.state:""),basis:location.basis==="Forecast near your mapped field"?"Field: "+location.name:location.basis}:location;
  return {location:resolved,timeZone:p.timeZone,days,current,forecastUrl:p.forecast,issuedAt:forecast.properties.updateTime??forecast.properties.updated??forecast.properties.generatedAt??null,retrievedAt:new Date().toISOString()};
}
