import test from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import { MAX_VOICE_BYTES, VoiceLimiter, validateVoiceFile, voiceForm, voiceTranscript } from "../lib/voice-transcription.ts";
const file=(type="audio/webm;codecs=opus",size=512)=>new File([new Uint8Array(size)],"untrusted-name.webm",{type});
test("recordings are normalized and unsupported, missing, empty, and oversized files are rejected",()=>{
  const result=validateVoiceFile(file());assert.equal(result.type,"audio/webm");assert.equal(result.name,"question.webm");
  assert.throws(()=>validateVoiceFile(null));assert.throws(()=>validateVoiceFile(file("text/html")));assert.throws(()=>validateVoiceFile(file("audio/webm",0)));assert.throws(()=>validateVoiceFile(file("audio/webm",MAX_VOICE_BYTES+1)));
});
test("multipart audio can be read and oversized declared requests stop before parsing",async()=>{
  const form=new FormData();form.append("audio",file());const request=new Request("http://localhost/api/assistant/transcribe",{method:"POST",body:form});
  assert.equal(validateVoiceFile((await voiceForm(request)).get("audio")).size,512);
  const large=new Request("http://localhost/api/assistant/transcribe",{method:"POST",headers:{"Content-Type":"multipart/form-data; boundary=test","Content-Length":String(MAX_VOICE_BYTES+20000)},body:"test"});
  await assert.rejects(voiceForm(large),error=>error.status===413);
});
test("successful transcripts are trimmed; silence, excessive duration, and oversized text never become chat messages",()=>{
  assert.equal(voiceTranscript({text:"  Review my corn field.  ",duration:3}),"Review my corn field.");
  assert.throws(()=>voiceTranscript({text:""}));assert.throws(()=>voiceTranscript({text:"hello",duration:90}));assert.throws(()=>voiceTranscript({text:"invented speech",segments:[{no_speech_prob:.99}]}));assert.throws(()=>voiceTranscript({text:"a".repeat(4001)}));
});
test("concurrent and repeated voice requests are limited, and users recover after the rolling window",()=>{
  const limiter=new VoiceLimiter();limiter.begin("farmer",1000);assert.throws(()=>limiter.begin("farmer",1001),error=>error.status===429);limiter.end("farmer");
  for(let i=0;i<5;i++){limiter.begin("farmer",1100+i);limiter.end("farmer");}assert.throws(()=>limiter.begin("farmer",1200));limiter.begin("farmer",62000);limiter.end("farmer");
});
test("the SDK sends audio only to the Groq transcription endpoint using its separate test credential",async()=>{
  let calls=0;
  const client=new OpenAI({apiKey:"test-only-placeholder",baseURL:"https://api.groq.com/openai/v1",maxRetries:0,fetch:async(input,init)=>{
    if(input==="data:,")return new Response(""); // SDK checks the fetch implementation's multipart support.
    calls++;const request=new Request(input,init);assert.equal(request.url,"https://api.groq.com/openai/v1/audio/transcriptions");assert.equal(request.headers.get("authorization"),"Bearer test-only-placeholder");
    const body=await request.formData();assert.equal(body.get("model"),"whisper-large-v3-turbo");assert.equal(body.get("response_format"),"verbose_json");assert.equal(body.get("language"),"en");assert.ok(body.get("file") instanceof File);
    return Response.json({text:"What tasks need attention?",duration:3,segments:[{no_speech_prob:.01}]});
  }});
  const response=await client.audio.transcriptions.create({file:validateVoiceFile(file()),model:"whisper-large-v3-turbo",response_format:"verbose_json",language:"en",temperature:0});
  assert.equal(voiceTranscript(response),"What tasks need attention?");assert.equal(calls,1);
});
