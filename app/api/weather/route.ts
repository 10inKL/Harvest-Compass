import { getSession } from "@/lib/assistant/server";
import { fieldWeatherPoint } from "@/lib/weather";
import { getNwsWeather } from "@/lib/nws-weather";

export async function GET(request:Request){
  let session;try{session=await getSession(request);}catch{return Response.json({error:"Sign in again to see your farm forecast."},{status:401});}
  if(!session.db)return Response.json({needsLocation:true,message:"Sign in to choose your farm forecast location."});
  const db=session.db;
  const [farm,fields]=await Promise.all([db.from("farms").select("name,location,latitude,longitude").eq("id",session.farmId).single(),db.from("fields").select("id,name,boundary_geojson").eq("farm_id",session.farmId).eq("boundary_confirmed",true).order("created_at")]);
  if(farm.error||fields.error)return Response.json({error:"Your weather location could not be loaded."},{status:503});
  const fieldId=new URL(request.url).searchParams.get("fieldId");
  const field=fieldId?fields.data?.find(f=>f.id===fieldId):fields.data?.find(f=>fieldWeatherPoint(f.boundary_geojson));
  if(fieldId&&!field)return Response.json({error:"Select a mapped field from your current farm."},{status:400});
  const saved=farm.data.latitude!==null&&farm.data.longitude!==null;
  const point=fieldId||!saved?fieldWeatherPoint(field?.boundary_geojson):[Number(farm.data.latitude),Number(farm.data.longitude)];
  if(!point)return Response.json({needsLocation:true,message:"Choose a town or map your first field to see local weather."});
  const location={name:fieldId||!saved?field?.name||farm.data.name:farm.data.location||farm.data.name,basis:fieldId||!saved?"Forecast near your mapped field":"Your saved weather location",latitude:point[0],longitude:point[1]};
  try{return Response.json(await getNwsWeather(location),{headers:{"Cache-Control":"private, no-store"}});}catch{return Response.json({error:"NOAA weather is temporarily unavailable. Please try again shortly."},{status:503});}
}
