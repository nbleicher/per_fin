import type { Account, Bill, Transaction } from "@/lib/types/domain";
import type {
  BudgetBatch,
  DashboardInitialData,
  DashboardSummary,
  Portfolio,
  PortfolioSnapshot,
} from "@/lib/types/dashboard";
import { aggregateSnapshotsByDate } from "@/lib/finance/snapshot-series";
import { fetchPaginatedList, parseOk } from "@/lib/api/client-fetch";

/** Same payload as [`loadDashboardInitialData`](lib/server/dashboard-initial.ts), loaded via HTTP for refresh/mutations. */
export async function fetchDashboardBundle(): Promise<DashboardInitialData> {
  const summaryData = await parseOk<DashboardSummary>(await fetch("/api/dashboard/summary"));
  const [accountsData, billsData, batchesData, txns, portfolios] = await Promise.all([
    fetchPaginatedList<Account>("/api/accounts"),
    fetchPaginatedList<Bill>("/api/bills"),
    parseOk<BudgetBatch[]>(await fetch("/api/budget-allocations")),
    fetchPaginatedList<Transaction>("/api/transactions"),
    fetchPaginatedList<Portfolio>("/api/portfolios"),
  ]);

  let allSnapshots: PortfolioSnapshot[] = [];
  for (const p of portfolios) {
    const snaps = await fetchPaginatedList<PortfolioSnapshot>(`/api/snapshots?portfolioId=${p.id}`);
    allSnapshots = allSnapshots.concat(snaps);
  }

  return {
    summary: summaryData,
    accounts: accountsData,
    bills: billsData,
    budgetBatches: batchesData,
    transactions: txns,
    snapshotSeries: aggregateSnapshotsByDate(allSnapshots),
  };
}
