import type { PortfolioSnapshot } from "@/lib/types/dashboard";

export function aggregateSnapshotsByDate(snapshots: PortfolioSnapshot[]) {
  const byDate = new Map<string, number>();
  for (const s of snapshots) {
    const day = new Date(s.snapshotDate).toISOString().slice(0, 10);
    byDate.set(day, (byDate.get(day) ?? 0) + s.totalValue);
  }
  const dates = [...byDate.keys()].sort();
  return dates.map((d) => ({ date: d, totalValue: byDate.get(d)! }));
}
