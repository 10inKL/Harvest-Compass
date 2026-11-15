"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordField({ id, label, value, onChange, autoComplete, hint }: { id: string; label: string; value: string; onChange: (value: string) => void; autoComplete: string; hint?: string }) {
  const [visible,setVisible]=useState(false);
  return <label className="auth-field" htmlFor={id}><span>{label}</span><span className="password-control"><input id={id} required type={visible?"text":"password"} value={value} onChange={event=>onChange(event.target.value)} autoComplete={autoComplete}/><button type="button" onClick={()=>setVisible(current=>!current)} aria-label={visible?`Hide ${label.toLowerCase()}`:`Show ${label.toLowerCase()}`}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></span>{hint&&<small>{hint}</small>}</label>;
}
