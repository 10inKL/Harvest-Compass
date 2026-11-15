export type ForecastPeriod = { name:string; startTime:string; endTime:string; isDaytime:boolean; temperature:number; temperatureUnit:string; shortForecast:string; detailedForecast:string; windSpeed:string; windDirection:string; probabilityOfPrecipitation?:{value:number|null} };
export type ForecastDay = {date:string;label:string;high:number|null;low:number|null;rainChance:number|null;summary:string;periods:ForecastPeriod[]};
export type FarmWeather = {location:{name:string;basis:string;latitude:number;longitude:number};timeZone:string;days:ForecastDay[];current:{temperature:number;description:string;wind:string|null;humidity:number|null;observedAt:string;station:string;source:string}|null;forecastUrl:string;issuedAt:string|null;retrievedAt:string};
export function localDate(value:string|number,timeZone:string){return new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));}
export function forecastDays(periods:ForecastPeriod[],timeZone:string,now=Date.now()):ForecastDay[]{
  const today=localDate(now,timeZone), groups=new Map<string,ForecastPeriod[]>();
  for(const period of periods){if(!Number.isFinite(period.temperature)||Date.parse(period.endTime)<=now)continue;const date=localDate(period.startTime,timeZone);if(date<today)continue;groups.set(date,[...(groups.get(date)??[]),period]);}
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).slice(0,7).map(([date,items])=>{
    const day=items.find(p=>p.isDaytime),night=items.find(p=>!p.isDaytime);
    const rain=items.map(p=>p.probabilityOfPrecipitation?.value).filter((v):v is number=>typeof v==="number"&&v>=0&&v<=100);
    return {date,label:date===today?"Today":new Intl.DateTimeFormat("en-US",{timeZone,weekday:"short"}).format(new Date(items[0].startTime)),high:day?fahrenheit(day.temperature,day.temperatureUnit):null,low:night?fahrenheit(night.temperature,night.temperatureUnit):null,rainChance:rain.length?Math.max(...rain):null,summary:(day??night??items[0]).shortForecast,periods:items};
  });
}
export function fahrenheit(value:number,unit:string){return Math.round(unit==="C"?value*9/5+32:value);}
export function fieldWeatherPoint(geometry:unknown):[number,number]|null{
  if(!geometry||typeof geometry!=="object")return null;
  const g=geometry as {type?:string;coordinates?:unknown};let ring:unknown;
  if(g.type==="Polygon"&&Array.isArray(g.coordinates))ring=g.coordinates[0];
  if(g.type==="MultiPolygon"&&Array.isArray(g.coordinates)&&Array.isArray(g.coordinates[0]))ring=g.coordinates[0][0];
  if(!Array.isArray(ring)||ring.length<4)return null;
  const points=ring.filter((p):p is number[]=>Array.isArray(p)&&typeof p[0]==="number"&&typeof p[1]==="number"&&Number.isFinite(p[0])&&Number.isFinite(p[1]));
  if(points.length<4)return null;
  const lngs=points.map(p=>p[0]),lats=points.map(p=>p[1]);
  const latitude=(Math.min(...lats)+Math.max(...lats))/2,longitude=(Math.min(...lngs)+Math.max(...lngs))/2;
  return latitude>=-90&&latitude<=90&&longitude>=-180&&longitude<=180?[latitude,longitude]:null;
}
