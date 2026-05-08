import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { loadDashboardInitialData } from "@/lib/server/dashboard-initial";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function DashboardPageRoute() {
  const initialData = await loadDashboardInitialData();
  return (
    <div className={styles.container}>
      <DashboardPage initialData={initialData} />
    </div>
  );
}
