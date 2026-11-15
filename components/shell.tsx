"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Map, Tractor, ListChecks, Sparkles, ChartNoAxesCombined, Leaf, ChevronDown, Warehouse, Wheat } from "lucide-react";
import { farm } from "@/lib/demo-data";
import { useFarm } from "./farm-provider";
const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/farm-map", label: "Farm Map", icon: Map },
  { href: "/operations", label: "Farm Operations", icon: Tractor },
  { href: "/harvest", label: "Harvest Log", icon: Wheat },
  { href: "/inventory", label: "Grain Inventory", icon: Warehouse },
  { href: "/action-plan", label: "Action Plan", icon: ListChecks },
  { href: "/ai-assistant", label: "AI Assistant", icon: Sparkles },
  { href: "/reports", label: "Reports & History", icon: ChartNoAxesCombined },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const {data,hosted,harvestAvailable,signOut}=useFarm();
  const title = nav.find((item) => item.href === path)?.label ?? "Overview";
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/dashboard"><span className="brand-mark"><Leaf size={23} strokeWidth={2.4}/></span><span><strong>HarvestCompass</strong><small>Plan Smarter. Harvest Better.</small></span></Link>
      <div className="sidebar-caption">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">{nav.filter(item=>harvestAvailable||!(["/harvest","/inventory"].includes(item.href))).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${path === href ? "active" : ""}`} aria-current={path === href ? "page" : undefined}><Icon size={19}/><span>{label}</span></Link>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-farm"><span className="farm-icon"><Leaf size={19}/></span><span><strong>{data.farmName}</strong><small>{hosted ? "Supabase workspace" : "Demo workspace"}</small></span></div>{hosted && <button className="signout-button" onClick={signOut}>Sign out</button>}<p>Built for better decisions, from planting to sale.</p></div>
    </aside>
    <div className="main-column"><header className="topbar"><div><div className="mobile-brand"><Leaf size={18}/> HarvestCompass</div><h1>{title}</h1><span className="breadcrumb">Farm workspace <span>/</span> {title}</span></div><div className="top-actions"><span className="season-pill">{farm.season}</span><span className="top-farm">{data.farmName}<ChevronDown size={14}/></span><span className="top-divider"/><span className="avatar" aria-label="User avatar placeholder">JD</span></div></header><main className="content">{children}</main></div>
  </div>;
}
