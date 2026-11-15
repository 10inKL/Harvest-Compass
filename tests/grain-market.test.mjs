import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGrainMarket, marketIsOlder } from "../lib/grain-market.ts";
import { fetchUsdaGrain } from "../lib/usda-grain.ts";

// Schema fixtures, not actual market quotes. No credentials or live API calls.
const now=new Date("2026-11-15T12:00:00Z");
const row=(overrides={})=>({commodity:"Corn",region_name:"East Central",report_date:"11/13/2026",price_unit:"$/Bu",sale_type:"Bid",delivery_period:"Current",price_min:"3.50",price_max:"3.95",price_avg:"3.74",grade:"US #2",...overrides});
const section=results=>({reportSection:"Report Detail",results});
test("USDA section results retain cash ranges, precise values, regions and source dates",()=>{
  const result=normalizeGrainMarket([section([row(),row({commodity:"Soybeans",price_min:"10.9875",price_max:"11.4875",price_avg:"11.1513"})]),{reportSection:"Futures Settlements",results:[row({price_avg:"4.00"})]}],now);
  assert.equal(result.bids.length,2);assert.equal(result.bids[1].average,11.1513);assert.equal(result.reportDate,"2026-11-13");assert.equal(result.retrievedAt,now.toISOString());
});
test("the verified USDA grain schema uses trade_loc, spaced price keys, dollar-per-bushel units and current Yes",()=>{
  const official={commodity:"Corn",trade_loc:"East Central",market_location_name:"Grain - South Dakota",report_date:"11/13/2026",price_unit:"$ Per Bushel","sale Type":"Bid","price Min":3.5,"price Max":3.95,avg_price:3.74,current:"Yes",conventional:"Conventional",grade:"US #2"};
  const result=normalizeGrainMarket(section([official]),now);
  assert.equal(result.bids[0].region,"East Central");assert.equal(result.bids[0].low,3.5);assert.equal(result.bids[0].delivery,"Current");
  for(const overrides of [{current:"No"},{conventional:"Organic"},{price_unit:"¢ Per Bushel"},{"sale Type":"Trade"}])assert.throws(()=>normalizeGrainMarket(section([{...official,...overrides}]),now));
});
test("unknown units, forward deliveries, organic quotes, future dates and malformed prices are excluded",()=>{
  for(const overrides of [{price_unit:"cents/bu"},{price_unit:""},{delivery_period:"Dec"},{organic:"Yes"},{report_date:"11/16/2026"},{report_date:"02/30/2026"},{price_min:"-3.5",price_max:"N/A",price_avg:null},{price_min:"4.00",price_max:"3.00"},{price_avg:"5.00"},{sale_type:"Trade"},{region_name:"Iowa"}]){
    assert.throws(()=>normalizeGrainMarket(section([row(overrides)]),now));
  }
});
test("only the latest report is shown and ambiguous price series are never averaged",()=>{
  const result=normalizeGrainMarket(section([row(),row({report_date:"11/12/2026",price_avg:"3.70"})]),now);assert.equal(result.bids.length,1);
  assert.throws(()=>normalizeGrainMarket(section([row(),row({price_avg:"3.75"})]),now));
  assert.equal(normalizeGrainMarket(section([row(),row()]),now).bids.length,1);
  assert.equal(marketIsOlder("2026-11-13",now),false);assert.equal(marketIsOlder("2026-11-01",now),true);
});
test("server sends the key only to the fixed USDA price endpoint and queries a single publication date",async()=>{
  let calls=0;
  const today=new Date().toISOString().slice(0,10);
  const data=await fetchUsdaGrain("mock-key-never-real",async(url,options)=>{
    calls++;
    assert.equal(new URL(url).hostname,"marsapi.ams.usda.gov");assert.equal(options.redirect,"error");
    if(calls===1){assert.equal(options.headers.Authorization,undefined);return Response.json({reports:[{id:3186,reportBeginDate:today}]});}
    assert.equal(options.headers.Authorization,"Basic "+Buffer.from("mock-key-never-real:").toString("base64"));
    assert.match(new URL(url).searchParams.get("q"),/^report_date=\d{2}\/\d{2}\/\d{4}$/);
    return Response.json(section([row({report_date:today})]));
  });
  assert.equal(calls,2);assert.equal(data.bids[0].crop,"Corn");
});
test("authentication and malformed provider results produce safe errors without exposing responses",async()=>{
  for(const status of [403,429,500]){
    let calls=0;
    await assert.rejects(fetchUsdaGrain("mock-key",async()=>++calls===1?Response.json({reports:[{id:3186,reportBeginDate:"2026-11-13"}]}):new Response("secret provider body",{status})),error=>!error.message.includes("secret")&&!error.message.includes("mock-key"));
  }
  await assert.rejects(fetchUsdaGrain("mock-key",async()=>Response.json({invalid:true})),/valid report date/);
});
