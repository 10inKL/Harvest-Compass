"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Mic, Square, X } from "lucide-react";
import { MAX_VOICE_BYTES, MAX_VOICE_SECONDS } from "@/lib/voice-transcription";
import styles from "./voice-input.module.css";

type Phase="idle"|"requesting"|"recording"|"processing"|"review";
type Props={disabled:boolean;remaining:number;authFetch:(url:string,options?:RequestInit)=>Promise<Response>;onTranscript:(text:string)=>void;onActiveChange:(active:boolean)=>void};
export function VoiceInput({disabled,remaining,authFetch,onTranscript,onActiveChange}:Props){
  const [phase,setPhase]=useState<Phase>("idle"),[seconds,setSeconds]=useState(0),[error,setError]=useState(""),[transcript,setTranscript]=useState("");
  const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),chunks=useRef<Blob[]>([]),bytes=useRef(0),generation=useRef(0),controller=useRef<AbortController|null>(null);
  const clock=useRef<ReturnType<typeof setInterval>|null>(null),limit=useRef<ReturnType<typeof setTimeout>|null>(null);
  const releaseCapture=useCallback(()=>{
    if(clock.current)clearInterval(clock.current);if(limit.current)clearTimeout(limit.current);clock.current=null;limit.current=null;
    if(recorder.current){recorder.current.ondataavailable=null;recorder.current.onstop=null;recorder.current.onerror=null;if(recorder.current.state!=="inactive")recorder.current.stop();recorder.current=null;}
    stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;chunks.current=[];bytes.current=0;
  },[]);
  useEffect(()=>()=>{generation.current++;controller.current?.abort();releaseCapture();},[releaseCapture]);
  function changePhase(next:Phase){setPhase(next);onActiveChange(next!=="idle");}
  function cancel(){generation.current++;controller.current?.abort();releaseCapture();setTranscript("");setError("");changePhase("idle");}
  function fail(message:string){generation.current++;controller.current?.abort();releaseCapture();setTranscript("");setError(message);changePhase("idle");}
  async function start(){
    if(disabled||phase!=="idle"||remaining<1)return;
    setError("");setTranscript("");setSeconds(0);
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined"){setError("Voice recording needs a supported browser and HTTPS (or localhost). You can still type your question.");return;}
    const id=++generation.current;controller.current=new AbortController();changePhase("requesting");
    try{
      const available=await authFetch("/api/assistant/transcribe",{signal:controller.current.signal});const config=await available.json();
      if(id!==generation.current)return;
      if(!available.ok||!config.configured){fail(config.error||"Voice input has not been enabled yet. You can still type your question.");return;}
      const capture=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      if(id!==generation.current){capture.getTracks().forEach(track=>track.stop());return;}
      stream.current=capture;
      const mime=["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg;codecs=opus"].find(type=>MediaRecorder.isTypeSupported(type));
      const recording=new MediaRecorder(capture,mime?{mimeType:mime}:undefined);recorder.current=recording;chunks.current=[];bytes.current=0;
      recording.ondataavailable=event=>{if(id!==generation.current||!event.data.size)return;chunks.current.push(event.data);bytes.current+=event.data.size;if(bytes.current>MAX_VOICE_BYTES)fail("The recording reached its size limit. Try a shorter question.");};
      recording.onerror=()=>{if(id===generation.current)fail("The microphone recording was interrupted. Please try again.");};
      recording.onstop=()=>{
        if(id!==generation.current)return;
        const audio=new Blob(chunks.current,{type:recording.mimeType||mime||"audio/webm"});releaseCapture();
        if(audio.size<256){fail("That recording was too short. Try speaking a little longer.");return;}
        void transcribe(audio,id);
      };
      recording.start(250);changePhase("recording");
      clock.current=setInterval(()=>setSeconds(value=>Math.min(MAX_VOICE_SECONDS,value+1)),1000);
      limit.current=setTimeout(()=>{if(recording.state==="recording")recording.stop();},MAX_VOICE_SECONDS*1000);
    }catch(e){if(id!==generation.current)return;const name=e instanceof Error?e.name:"";fail(name==="NotAllowedError"?"Microphone permission was denied. Allow microphone access in your browser and try again.":name==="NotFoundError"?"No microphone was found. Connect a microphone or type your question.":name==="NotReadableError"?"Your microphone is busy. Close other recording apps and try again.":"Voice recording could not start. Please try again or type your question.");}
  }
  async function transcribe(audio:Blob,id:number){
    changePhase("processing");
    limit.current=setTimeout(()=>{if(id===generation.current)fail("Transcription took too long. Please try again or type your question.");},45000);
    const form=new FormData();form.append("audio",audio,"question."+(audio.type.includes("mp4")?"mp4":audio.type.includes("ogg")?"ogg":"webm"));
    try{
      const response=await authFetch("/api/assistant/transcribe",{method:"POST",body:form,signal:controller.current?.signal});const result=await response.json();if(id!==generation.current)return;
      if(!response.ok)throw new Error(result.error||"Transcription failed. Please try again.");
      if(typeof result.text!=="string"||!result.text.trim())throw new Error("No speech was detected. Please try again.");
      setTranscript(result.text.trim());changePhase("review");
    }catch(e){if(id===generation.current)fail(e instanceof Error?e.message:"Voice transcription is unavailable. You can still type your question.");}
    finally{if(id===generation.current&&limit.current){clearTimeout(limit.current);limit.current=null;}}
  }
  function useTranscript(){const value=transcript.trim();if(!value||value.length>remaining)return;onTranscript(value);setTranscript("");setError("");changePhase("idle");}
  return <div className={styles.root}>
    <button type="button" className={styles.mic} aria-label={phase==="idle"?"Record a voice question":"Voice input is active"} title="Record a question · transcribed by Groq" disabled={disabled||phase!=="idle"||remaining<1} onClick={()=>void start()}><Mic size={19}/></button>
    {(phase!=="idle"||error)&&<div className={styles.popup} role="region" aria-label="Voice input"><header><strong>{phase==="recording"?"Listening to your question":phase==="processing"?"Turning speech into text":phase==="review"?"Review your transcript":phase==="requesting"?"Getting the microphone ready":"Voice input"}</strong><button type="button" aria-label="Cancel voice input" onClick={cancel}><X size={16}/></button></header>
      {phase==="requesting"&&<p className={styles.status}><LoaderCircle size={17} className={styles.spin}/>Allow microphone access when your browser asks.</p>}
      {phase==="recording"&&<><div className={styles.recording}><span/><strong>{String(Math.floor(seconds/60)).padStart(2,"0")}:{String(seconds%60).padStart(2,"0")}</strong><small>Up to 60 seconds</small></div><p>Speak naturally. Stop when you finish your question.</p><button type="button" className={styles.action} onClick={()=>{if(recorder.current?.state==="recording")recorder.current.stop();}}><Square size={13}/> Stop &amp; transcribe</button></>}
      {phase==="processing"&&<p className={styles.status}><LoaderCircle size={18} className={styles.spin}/>Transcribing your recording…</p>}
      {phase==="review"&&<><textarea aria-label="Edit your voice transcript" value={transcript} onChange={event=>setTranscript(event.target.value)} rows={4} maxLength={4000}/><p>Check field names and numbers, then add this text to your message.</p>{transcript.trim().length>remaining&&<p className={styles.error} role="alert">Shorten this transcript to {remaining} characters or fewer to fit your current message.</p>}<button type="button" className={styles.action} disabled={!transcript.trim()||transcript.trim().length>remaining} onClick={useTranscript}><Check size={16}/> Add to message</button></>}
      {error&&<p className={styles.error} role="alert">{error}</p>}
      <footer>Audio is sent to Groq for transcription. Your question is sent to the assistant only after you press Send. HarvestCompass does not save the audio.</footer>
    </div>}
  </div>;
}
