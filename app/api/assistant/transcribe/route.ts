import OpenAI from "openai";
import { getSession } from "@/lib/assistant/server";
import { validateVoiceFile, voiceForm, voiceTranscript, VoiceError, VoiceLimiter } from "@/lib/voice-transcription";
const limiter=new VoiceLimiter();
const headers={"Cache-Control":"no-store"};
async function voiceUser(request:Request){const session=await getSession(request);if(!session.userId||session.demo)throw new Error("Sign in required");return session.userId;}
export async function GET(request:Request){
  try{await voiceUser(request);return Response.json({configured:!!process.env.GROQ_API_KEY,maxSeconds:60,provider:"Groq"},{headers});}catch{return Response.json({error:"Sign in to use voice input."},{status:401,headers});}
}
export async function POST(request:Request){
  let userId:string;try{userId=await voiceUser(request);}catch{return Response.json({error:"Your session expired. Sign in again before recording."},{status:401,headers});}
  if(!process.env.GROQ_API_KEY)return Response.json({error:"Voice input is not configured yet. Your app administrator needs to enable it. You can still type your question."},{status:503,headers});
  let started=false;
  try{
    const file=validateVoiceFile((await voiceForm(request)).get("audio"));
    limiter.begin(userId);started=true;
    const model=process.env.GROQ_TRANSCRIPTION_MODEL||"whisper-large-v3-turbo";
    if(!["whisper-large-v3-turbo","whisper-large-v3"].includes(model))throw new VoiceError("The voice transcription model is not configured correctly.",503);
    // A separate client and credential are used exclusively for Groq audio.
    // The OpenAI key, chat history, and farm records are never sent to Groq.
    const client=new OpenAI({apiKey:process.env.GROQ_API_KEY,baseURL:"https://api.groq.com/openai/v1",timeout:30000,maxRetries:0});
    const result=await client.audio.transcriptions.create({file,model,response_format:"verbose_json",language:"en",temperature:0},{signal:request.signal});
    return Response.json({text:voiceTranscript(result)},{headers});
  }catch(e){
    if(e instanceof VoiceError)return Response.json({error:e.message},{status:e.status,headers});
    if(e instanceof OpenAI.APIError&&e.status===429)return Response.json({error:"The voice service’s free quota is temporarily unavailable. Wait a little, or type your question."},{status:429,headers:{...headers,"Retry-After":"60"}});
    if(e instanceof OpenAI.APIError&&e.status===400)return Response.json({error:"The audio could not be transcribed. Please record a short, clear question."},{status:422,headers});
    return Response.json({error:"Voice transcription is temporarily unavailable. Please try again or type your question."},{status:503,headers});
  }finally{if(started)limiter.end(userId);}
}
