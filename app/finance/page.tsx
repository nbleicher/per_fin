import { FinanceWorkspaceShell } from "@/features/finance/finance-workspace-shell";
import styles from "./page.module.css";

export default function FinancePage() {
  return (
    <div className={styles.container}>
      <FinanceWorkspaceShell />
    </div>
  );
}
