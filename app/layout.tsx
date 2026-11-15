import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { FarmProvider } from "@/components/farm-provider";
const geist = Geist({ subsets: ["latin"] });
export const metadata: Metadata = { title: "HarvestCompass | Plan Smarter. Harvest Better.", description: "Farm operations and decision support for the whole season." };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body className={geist.className}><FarmProvider>{children}</FarmProvider></body></html>; }
