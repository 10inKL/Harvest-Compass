"use client";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Leaf, MapPinned, Sparkles, Wheat } from "lucide-react";

export function AuthLayout({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <main className="auth-layout">
    <section className="auth-brand-panel">
      <Link className="welcome-logo auth-brand-logo" href="/"><span><Leaf size={22}/></span>HarvestCompass</Link>
      <div className="auth-brand-copy"><span className="welcome-eyebrow">PLAN SMARTER. HARVEST BETTER.</span><h2>One dependable workspace for the whole farming season.</h2><p>Bring fields, operations, harvest records, inventory, and decision support together without losing control of the final call.</p>
        <div className="auth-brand-points"><span><MapPinned size={18}/> Confirm real field boundaries</span><span><Wheat size={18}/> Track harvest through grain sales</span><span><Sparkles size={18}/> Use AI with your saved farm context</span></div>
      </div>
      <p className="auth-brand-note"><CheckCircle2 size={16}/> Important farm plan changes always require farmer approval.</p>
    </section>
    <section className="auth-form-panel"><div className="auth-form-wrap"><Link className="auth-back" href="/"><ArrowLeft size={16}/> Back to welcome</Link><div className="auth-form-heading"><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{children}</div></section>
  </main>;
}
