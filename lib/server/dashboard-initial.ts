import { prisma } from "@/lib/db/prisma";
import { transactionDomainSelect } from "@/lib/db/transaction-select";
import { computeDashboardSummary } from "@/lib/finance/dashboard-summary";
import { aggregateSnapshotsByDate } from "@/lib/finance/snapshot-series";
import type { Account, Bill, Transaction } from "@/lib/types/domain";
import type { DashboardInitialData, PortfolioSnapshot } from "@/lib/types/dashboard";
import type { OwnerType } from "@prisma/client";

function mapAccount(row: {
  id: number;
  name: string;
  ownerType: OwnerType;
  accountSubtype: Account["accountSubtype"];
  annualRatePercent: number | null;
  limitAmount: number | null;
  startingBalance: number;
  startingDate: Date | null;
  isActive: boolean;
}): Account {
  return {
    id: row.id,
    name: row.name,
    ownerType: row.ownerType as Account["ownerType"],
    accountSubtype: row.accountSubtype,
    annualRatePercent: row.annualRatePercent,
    limitAmount: row.limitAmount,
    startingBalance: row.startingBalance,
    startingDate: row.startingDate ? row.startingDate.toISOString().slice(0, 10) : null,
    isActive: row.isActive,
  };
}

function mapTransaction(row: {
  id: number;
  date: Date;
  yearMonth: string;
  description: string;
  amount: number;
  type: Transaction["type"];
  source: Transaction["source"];
  fromAccountId: number | null;
  toAccountId: number | null;
  billId: number | null;
  category: string | null;
  notes: string | null;
}): Transaction {
  return {
    id: row.id,
    date: row.date.toISOString(),
    yearMonth: row.yearMonth,
    description: row.description,
    amount: row.amount,
    type: row.type,
    source: row.source,
    fromAccountId: row.fromAccountId,
    toAccountId: row.toAccountId,
    billId: row.billId,
    category: row.category,
    notes: row.notes,
  };
}

function mapBill(row: {
  id: number;
  name: string;
  defaultAmount: number;
  dueDay: number;
  dueGroup: string | null;
  category: string | null;
  active: boolean;
  defaultFromAccountId: number | null;
  defaultToAccountId: number | null;
}): Bill {
  return {
    id: row.id,
    name: row.name,
    defaultAmount: row.defaultAmount,
    dueDay: row.dueDay,
    dueGroup: row.dueGroup,
    category: row.category,
    active: row.active,
    defaultFromAccountId: row.defaultFromAccountId,
    defaultToAccountId: row.defaultToAccountId,
  };
}

export async function loadDashboardInitialData(): Promise<DashboardInitialData> {
  const [accountRows, billRows, batchRows, txnRows, portfolioRows] = await Promise.all([
    prisma.account.findMany({ orderBy: { id: "asc" } }),
    prisma.bill.findMany({ orderBy: { id: "asc" } }),
    prisma.budgetAllocationBatch.findMany({
      orderBy: { submittedAt: "desc" },
      take: 20,
      include: { items: true },
    }),
    prisma.transaction.findMany({
      orderBy: [{ date: "asc" }, { id: "asc" }],
      select: transactionDomainSelect,
    }),
    prisma.portfolio.findMany({ orderBy: { id: "asc" } }),
  ]);

  const accounts = accountRows.map(mapAccount);
  const bills = billRows.map(mapBill);
  const transactions = txnRows.map(mapTransaction);

  const activeForSummary = accountRows.filter((a) => a.isActive);
  const summary = computeDashboardSummary(activeForSummary, txnRows);

  const budgetBatches = batchRows.map((b) => ({
    id: b.id,
    weeklyPay: b.weeklyPay,
    submittedAt: b.submittedAt.toISOString(),
    notes: b.notes,
    items: b.items.map((i) => ({
      accountId: i.accountId,
      percent: i.percent,
      amount: i.amount,
    })),
  }));

  const portfolioIds = portfolioRows.map((p) => p.id);
  const snapshotRows =
    portfolioIds.length === 0
      ? []
      : await prisma.portfolioSnapshot.findMany({
          where: { portfolioId: { in: portfolioIds } },
          orderBy: [{ snapshotDate: "desc" }, { id: "desc" }],
        });

  const snapshots: PortfolioSnapshot[] = snapshotRows.map((s) => ({
    id: s.id,
    portfolioId: s.portfolioId,
    snapshotDate: s.snapshotDate.toISOString(),
    totalValue: s.totalValue,
    investedAmount: s.investedAmount,
    unrealizedPnL: s.unrealizedPnL,
  }));

  const snapshotSeries = aggregateSnapshotsByDate(snapshots);

  return {
    summary,
    accounts,
    bills,
    transactions,
    budgetBatches,
    snapshotSeries,
  };
}
