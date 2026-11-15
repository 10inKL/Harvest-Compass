import { normalizeGrainMarket, type GrainMarket } from "./grain-market.ts";

const endpoint="https://marsapi.ams.usda.gov/services/v1.2/reports/3186?allSections=true";
export class GrainServiceError extends Error{}
let cached:{data:GrainMarket;expires:number}|null=null;
let pending:Promise<GrainMarket>|null=null;
let retryAfter=0;

export async function fetchUsdaGrain(apiKey:string,fetcher:typeof fetch=fetch):Promise<GrainMarket>{
  // Public publication metadata limits the authenticated query to one report date.
  const publication=await fetcher("https://marsapi.ams.usda.gov/services/v3.1/public/listPublishedReport/3186?format=json",{headers:{Accept:"application/json"},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000)});
  if(!publication.ok)throw new GrainServiceError("USDA report dates are temporarily unavailable.");
  const metadata=await publication.json() as {reports?:{id:number;reportBeginDate:string}[]};
  const latest=metadata.reports?.find(report=>report.id===3186)?.reportBeginDate;
  if(!latest||!/^\d{4}-\d{2}-\d{2}$/.test(latest))throw new GrainServiceError("USDA has not provided a valid report date.");
  const [year,month,day]=latest.split("-");
  const query=new URL(endpoint);query.searchParams.set("q",`report_date=${month}/${day}/${year}`);
  const response=await fetcher(query,{headers:{Authorization:"Basic "+Buffer.from(apiKey+":").toString("base64"),Accept:"application/json"},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new GrainServiceError(response.status===401||response.status===403?"The market data connection needs administrator attention.":response.status===429?"USDA is limiting requests. Please try again later.":"USDA market data is temporarily unavailable.");
  try{const data=normalizeGrainMarket(await response.json());if(data.reportDate!==latest)throw new Error("Report date mismatch");return data;}
  catch{throw new GrainServiceError("USDA cash bids could not be read reliably. View the original report below.");}
}
export async function getUsdaGrain():Promise<GrainMarket>{
  const key=process.env.USDA_MARKET_NEWS_API_KEY;
  if(!key)throw new GrainServiceError("Market data has not been connected yet.");
  if(cached&&cached.expires>Date.now())return cached.data;
  if(pending)return pending;
  if(retryAfter>Date.now())throw new GrainServiceError("USDA market data is temporarily unavailable. Please try again shortly.");
  pending=fetchUsdaGrain(key).then(data=>{cached={data,expires:Date.now()+3600000};return data;}).catch(error=>{retryAfter=Date.now()+60000;throw error;}).finally(()=>{pending=null;});
  return pending;
}
