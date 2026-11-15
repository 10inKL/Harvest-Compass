"use client";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { useFarm } from "./farm-provider";
import { DownloadFarmReport } from "./download-farm-report";
import { FarmWeatherPanel } from "./farm-weather";
import styles from "./farm-home-header.module.css";

export function FarmHomeHeader(){
  const {data,user}=useFarm();
  const fullName=typeof user?.user_metadata?.full_name==="string"?user.user_metadata.full_name.trim():"";
  const firstName=fullName.split(/\s+/)[0];
  const hour=new Date().getHours();
  const greeting=hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";
  const pending=data.tasks.filter(task=>!task.done).length;
  return <section className={styles.home} aria-label="Welcome to your farm">
    <header className={styles.welcome}><div className={styles.intro}><div className={styles.date}><CalendarDays size={13}/>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}{data.demoSeeded&&<span>Demo workspace</span>}</div><h1>{greeting}{firstName?", "+firstName:""}<span>.</span></h1><p>Here’s your day at <strong>{data.farmName}</strong>.</p><div className={styles.meta}><span><MapPin size={13}/>{data.farmLocation==="Not set"?"Farm location not set":data.farmLocation}</span><i/><span>{data.seasonYear} season</span></div></div><div className={styles.actions}><Link href="/action-plan" className={styles.tasks}><span className={styles.taskNumber}>{pending}</span><span><strong>{pending===1?"task to plan around":"tasks to plan around"}</strong><small>Open your action plan <ArrowUpRight size={12}/></small></span></Link><DownloadFarmReport compact/></div></header>
    <FarmWeatherPanel embedded/>
  </section>;
}
