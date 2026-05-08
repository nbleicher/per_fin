import { StrategyPage as StrategyScreen } from "@/features/strategy/strategy-page";
import styles from "./page.module.css";

export default function StrategyPage() {
  return (
    <div className={styles.container}>
      <StrategyScreen />
    </div>
  );
}
