export const GRAIN_REPORT_URL="https://mymarketnews.ams.usda.gov/viewReport/3186";
export const GRAIN_REGIONS=["East Central","Southeast","Northeast","Central","North Central"] as const;
export type GrainRegion=typeof GRAIN_REGIONS[number];
export interface GrainBid{crop:"Corn"|"Soybeans";region:GrainRegion;reportDate:string;low:number|null;high:number|null;average:number|null;delivery:string;grade:string;}
export interface GrainMarket{bids:GrainBid[];reportDate:string;retrievedAt:string;sourceUrl:string;}

type Row=Record<string,unknown>;
function field(row:Row,...keys:string[]):string{
  for(const key of keys){const value=row[key];if(typeof value==="string"&&value.trim())return value.trim();if(typeof value==="number")return String(value);}
  return "";
}
function number(value:string):number|null{
  if(!/^\d+(?:\.\d+)?$/.test(value))return null;
  const result=Number(value);return Number.isFinite(result)&&result>0&&result<100?result:null;
}
function date(value:string):string|null{
  let match=value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T| |$)/);
  if(!match){const us=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: |$)/);if(us)match=[us[0],us[3],us[1].padStart(2,"0"),us[2].padStart(2,"0")];}
  if(!match)return null;
  const result=`${match[1]}-${match[2]}-${match[3]}`;
  const parsed=new Date(result+"T00:00:00Z");return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===result?result:null;
}
function rows(value:unknown,section=""):Row[]{
  if(Array.isArray(value))return value.flatMap(item=>rows(item,section));
  if(!value||typeof value!=="object")return [];
  const object=value as Row;
  const name=field(object,"reportSection","report_section")||section;
  if(/futures|settlement/i.test(name))return [];
  if(Array.isArray(object.results))return rows(object.results,name);
  return [{...object,_section:name}];
}
/** Fail closed on unknown units, futures rows, malformed prices and dates. No inferred prices. */
export function normalizeGrainMarket(payload:unknown,now=new Date()):GrainMarket{
  const bids:GrainBid[]=[];
  const today=now.toISOString().slice(0,10);
  for(const raw of rows(payload)){
    // The grain feed mixes snake_case with labels such as "price Min" and "sale Type".
    const row=Object.fromEntries(Object.entries(raw).map(([key,value])=>[key.toLowerCase().replace(/\s+/g,"_"),value]));
    const commodity=field(row,"commodity","commodity_name");
    const crop=/^(corn|soybeans)$/i.test(commodity)?(/^corn$/i.test(commodity)?"Corn":"Soybeans"):null;
    if(!crop)continue;
    const regionText=field(row,"trade_loc","region_name","region","market_location_name","location","location_name");
    const region=GRAIN_REGIONS.find(item=>item.toLowerCase()===regionText.toLowerCase());
    const reportDate=date(field(row,"report_date","report_begin_date"));
    const unit=field(row,"price_unit","price_units","unit_of_sale","unit").toLowerCase().replace(/\s/g,"");
    if(!region||!reportDate||reportDate>today||!["$/bu","$/bushel","$perbushel","usd/bu","usd/bushel","dollars/bushel"].includes(unit))continue;
    const sale=field(row,"sale_type","bid_type","transaction_type");
    if(sale&&!/^bid$/i.test(sale))continue;
    const current=field(row,"current").toLowerCase();
    if(current&&current!=="yes")continue;
    const delivery=field(row,"delivery_period","delivery","delivery_description")||(current==="yes"?"Current":"");
    // Keep forward contracts and organic premiums out of the current conventional cash comparison.
    if(!/^current(?: delivery)?$/i.test(delivery))continue;
    const organic=field(row,"organic","production_practice","conventional");
    if(/^(yes|organic)$/i.test(organic))continue;
    const low=number(field(row,"price_min","price_low","low_price"));
    const high=number(field(row,"price_max","price_high","high_price"));
    const average=number(field(row,"price_avg","average_price","avg_price","weighted_avg_price"));
    if(low===null&&high===null&&average===null)continue;
    if(low!==null&&high!==null&&low>high)continue;
    if(average!==null&&((low!==null&&average<low)||(high!==null&&average>high)))continue;
    bids.push({crop,region,reportDate,low,high,average,delivery,grade:[field(row,"grade"),field(row,"class","class_name")].filter(Boolean).join(" · ")});
  }
  const reportDate=bids.map(bid=>bid.reportDate).sort().at(-1);
  if(!reportDate)throw new Error("No supported current-delivery cash bids were returned by USDA.");
  const latest=bids.filter(bid=>bid.reportDate===reportDate);
  // Multiple price series must not be silently averaged or arbitrarily selected.
  const unique=latest.filter((bid,index,all)=>all.findIndex(other=>JSON.stringify(other)===JSON.stringify(bid))===index);
  const unambiguous=unique.filter(bid=>unique.filter(other=>other.crop===bid.crop&&other.region===bid.region).length===1);
  if(!unambiguous.length)throw new Error("USDA returned multiple price series requiring review.");
  return {bids:unambiguous,reportDate,retrievedAt:now.toISOString(),sourceUrl:GRAIN_REPORT_URL};
}
export function marketIsOlder(reportDate:string,now=new Date()):boolean{return now.getTime()-new Date(reportDate+"T23:59:59-06:00").getTime()>4*86400000;}
