import DashboardOverview from "@/components/dashboard-overview";

// This workspace waits for browser authentication and farm records before rendering.
// Do not validate this route as an instantly rendered public page.
export const instant = false;

export default function DashboardPage(){return <DashboardOverview/>;}
