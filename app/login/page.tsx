"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { PasswordField } from "@/components/password-field";
import { useFarm } from "@/components/farm-provider";
import { supabase } from "@/lib/supabase-client";

function destination(onboardingIncomplete:boolean){
  const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("next"):null;
  return requested?.startsWith("/")&&!requested.startsWith("//")?requested:onboardingIncomplete?"/onboarding":"/dashboard";
}
export default function LoginPage(){
  const router=useRouter();
  const {user,ready}=useFarm();
  const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
  useEffect(()=>{const params=new URLSearchParams(window.location.search);const message=params.get("reset")==="1"?"Your password was updated. Sign in with your new password.":params.get("confirmed")==="1"?"Your email is confirmed. Sign in to finish setting up your farm.":"";if(message)queueMicrotask(()=>setNotice(message));},[]);
  useEffect(()=>{if(ready&&user)router.replace(destination(user.user_metadata?.onboarding_complete===false));},[ready,user,router]);
  async function submit(event:FormEvent){event.preventDefault();setError("");if(!supabase){setError("Supabase authentication is not configured.");return;}setBusy(true);const result=await supabase.auth.signInWithPassword({email:email.trim(),password});setBusy(false);if(result.error){setError(result.error.message.toLowerCase().includes("invalid login")?"Email or password is incorrect.":result.error.message);return;}router.replace(destination(result.data.user.user_metadata?.onboarding_complete===false));}
  return <AuthLayout eyebrow="WELCOME BACK" title="Sign in to your farm" description="Continue with your private HarvestCompass workspace."><form className="auth-form" onSubmit={submit}><label className="auth-field" htmlFor="login-email"><span>Email address</span><input id="login-email" required type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com"/></label><PasswordField id="login-password" label="Password" value={password} onChange={setPassword} autoComplete="current-password"/><div className="auth-form-row"><span>Sessions stay signed in on this device.</span><Link href="/forgot-password">Forgot password?</Link></div>{notice&&<p className="auth-message success" role="status">{notice}</p>}{error&&<p className="auth-message error" role="alert">{error}</p>}<button className="auth-submit" disabled={busy} type="submit">{busy?"Signing in…":<><LogIn size={17}/> Sign in <ArrowRight size={17}/></>}</button></form><p className="auth-switch">New to HarvestCompass? <Link href="/signup">Create an account</Link></p></AuthLayout>;
}
