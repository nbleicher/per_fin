import { TransactionsPage as TransactionsScreen } from "@/features/transactions/transactions-page";
import styles from "./page.module.css";

export default function TransactionsPage() {
  return (
    <div className={styles.container}>
      <TransactionsScreen />
    </div>
  );
}
