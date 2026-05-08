import { SettingsPage as SettingsScreen } from "@/features/settings/settings-page";
import styles from "./page.module.css";

export default function SettingsPage() {
  return (
    <div className={styles.container}>
      <SettingsScreen />
    </div>
  );
}
