import test from "node:test";
import assert from "node:assert/strict";
import { forecastDays, fieldWeatherPoint, fahrenheit } from "../lib/weather.ts";
import { getNwsWeather } from "../lib/nws-weather.ts";
const period=(overrides={})=>({name:"Today",startTime:"2026-11-15T06:00:00-06:00",endTime:"2026-11-15T18:00:00-06:00",isDaytime:true,temperature:50,temperatureUnit:"F",shortForecast:"Sunny",detailedForecast:"Sunny with light wind.",windSpeed:"5 mph",windDirection:"S",probabilityOfPrecipitation:{value:null},...overrides});
const now=Date.parse("2026-11-15T12:00:00Z");
test("daily highs and lows respect the farm timezone and use the peak known period chance",()=>{
  const days=forecastDays([period({probabilityOfPrecipitation:{value:20}}),period({name:"Tonight",startTime:"2026-11-15T18:00:00-06:00",endTime:"2026-11-16T06:00:00-06:00",isDaytime:false,temperature:29,probabilityOfPrecipitation:{value:60}})],"America/Chicago",now);
  assert.equal(days.length,1);assert.equal(days[0].label,"Today");assert.equal(days[0].high,50);assert.equal(days[0].low,29);assert.equal(days[0].rainChance,60);
});
test("missing precipitation and daytime temperatures stay unknown, not zero",()=>{
  const [day]=forecastDays([period({isDaytime:false,temperature:30})],"America/Chicago",now);
  assert.equal(day.high,null);assert.equal(day.low,30);assert.equal(day.rainChance,null);
});
test("expired forecast periods are dropped and forecasts are limited to seven available days",()=>{
  assert.deepEqual(forecastDays([period({endTime:"2026-11-15T05:00:00Z"})],"America/Chicago",now),[]);
  const periods=Array.from({length:10},(_,i)=>period({startTime:new Date(now+i*86400000).toISOString(),endTime:new Date(now+i*86400000+3600000).toISOString()}));
  assert.equal(forecastDays(periods,"America/Chicago",now).length,7);
});
test("saved field geometry yields a representative point; invalid geometry is rejected",()=>{
  assert.deepEqual(fieldWeatherPoint({type:"Polygon",coordinates:[[[-97,44],[-96,44],[-96,45],[-97,44]]]}),[44.5,-96.5]);
  assert.equal(fieldWeatherPoint(null),null);assert.equal(fieldWeatherPoint({type:"Polygon",coordinates:[]}),null);
  assert.equal(fahrenheit(0,"C"),32);
});
test("a station outage does not prevent a real forecast from being returned",async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async url=>{
    if(String(url).includes("/points/"))return Response.json({properties:{forecast:"https://api.weather.gov/gridpoints/FSD/test/forecast",observationStations:"https://api.weather.gov/stations/test",timeZone:"America/Chicago"}});
    if(String(url).includes("/stations/"))return new Response(null,{status:503});
    return Response.json({properties:{updateTime:new Date().toISOString(),periods:[period({startTime:new Date(Date.now()+3600000).toISOString(),endTime:new Date(Date.now()+7200000).toISOString()})]}});
  };
  try{const result=await getNwsWeather({name:"Test field",basis:"Mapped field",latitude:44,longitude:-97});assert.equal(result.current,null);assert.equal(result.days.length,1);assert.ok(result.issuedAt);}finally{globalThis.fetch=original;}
});
test("non-NOAA URLs are rejected before fetching",async()=>{
  const {nwsJson}=await import("../lib/nws-weather.ts");await assert.rejects(nwsJson("https://example.com/forecast"),/Invalid weather source/);
});
