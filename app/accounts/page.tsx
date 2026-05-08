import { AccountsPage as AccountsScreen } from "@/features/accounts/accounts-page";
import styles from "./page.module.css";

export default function AccountsPage() {
  return (
    <div className={styles.container}>
      <AccountsScreen />
    </div>
  );
}
