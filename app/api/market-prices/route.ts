import { getSession } from "@/lib/assistant/server";
import { getUsdaGrain, GrainServiceError } from "@/lib/usda-grain";

export async function GET(request:Request){
  try{const session=await getSession(request);if(!session.userId)return Response.json({error:"Sign in to see market prices."},{status:401});}
  catch{return Response.json({error:"Sign in again to see market prices."},{status:401});}
  if(!process.env.USDA_MARKET_NEWS_API_KEY)return Response.json({configured:false,message:"Grain prices are not connected yet."},{headers:{"Cache-Control":"private, no-store"}});
  try{return Response.json({configured:true,...await getUsdaGrain()},{headers:{"Cache-Control":"private, no-store"}});}
  catch(error){return Response.json({error:error instanceof GrainServiceError?error.message:"USDA market data is temporarily unavailable."},{status:503});}
}
