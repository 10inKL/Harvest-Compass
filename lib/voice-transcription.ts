export const MAX_VOICE_BYTES=4*1024*1024;
export const MAX_VOICE_SECONDS=60;
const formats:Record<string,string>={"audio/webm":"webm","audio/mp4":"mp4","audio/ogg":"ogg","audio/wav":"wav","audio/x-wav":"wav","audio/mpeg":"mp3","audio/flac":"flac","audio/x-m4a":"m4a"};
export class VoiceError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export function validateVoiceFile(file:FormDataEntryValue|null):File{
  if(!(file instanceof File))throw new VoiceError("Record a voice question first.");
  if(file.size<256)throw new VoiceError("The recording was too short. Please record your question again.");
  if(file.size>MAX_VOICE_BYTES)throw new VoiceError("That recording is too large. Keep your question under one minute.",413);
  const type=file.type.split(";")[0].toLowerCase();
  if(!formats[type])throw new VoiceError("This audio format is not supported. Try recording in Chrome, Edge, or Safari.",415);
  return new File([file],"question."+formats[type],{type});
}
export function voiceTranscript(result:{text?:unknown;duration?:unknown;segments?:{no_speech_prob?:number}[]}):string{
  if(typeof result.duration==="number"&&result.duration>MAX_VOICE_SECONDS+5)throw new VoiceError("Please keep each voice question under one minute.",422);
  if(result.segments?.length&&result.segments.every(segment=>(segment.no_speech_prob??0)>=.8))throw new VoiceError("No clear speech was detected. Move closer to the microphone and try again.",422);
  const text=typeof result.text==="string"?result.text.trim():"";
  if(!text)throw new VoiceError("No speech was detected. Please try again.",422);
  if(text.length>4000)throw new VoiceError("That question is too long. Please record a shorter version.",422);
  return text;
}
export class VoiceLimiter{
  private users=new Map<string,number[]>();private all:number[]=[];private active=new Set<string>();
  begin(userId:string,now=Date.now()){
    for(const [id,times] of this.users)if(!times.some(time=>now-time<60000))this.users.delete(id);
    this.all=this.all.filter(time=>now-time<60000);const times=(this.users.get(userId)??[]).filter(time=>now-time<60000);
    if(this.active.has(userId)||times.length>=6||this.all.length>=20||this.users.size>5000)throw new VoiceError("Voice input is busy or its free-tier limit was reached. Wait a minute, or type your question.",429);
    this.active.add(userId);this.users.set(userId,[...times,now]);this.all.push(now);
  }
  end(userId:string){this.active.delete(userId);}
}
export async function voiceForm(request:Request):Promise<FormData>{
  const type=request.headers.get("content-type")||"";
  if(!type.toLowerCase().startsWith("multipart/form-data"))throw new VoiceError("Send an audio recording.");
  const limit=MAX_VOICE_BYTES+16384;
  if(Number(request.headers.get("content-length"))>limit)throw new VoiceError("That recording is too large.",413);
  if(!request.body)throw new VoiceError("The recording is missing.");
  const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new VoiceError("That recording is too large.",413);}chunks.push(value);}}finally{reader.releaseLock();}
  const buffer=new Uint8Array(size);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}
  try{return await new Response(buffer,{headers:{"Content-Type":type}}).formData();}catch{throw new VoiceError("The audio upload could not be read. Please try again.");}
}
