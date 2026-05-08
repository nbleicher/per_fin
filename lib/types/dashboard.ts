import type { Account, Bill, Transaction } from "@/lib/types/domain";

export type DashboardSummary = {
  netWorth: number;
  assets: number;
  liabilities: number;
  monthIncome: number;
  monthExpenses: number;
  monthTransfers: number;
  accountCount: number;
  transactionCount: number;
};

export type Portfolio = { id: number; name: string };

export type PortfolioSnapshot = {
  id: number;
  portfolioId: number;
  snapshotDate: string;
  totalValue: number;
  investedAmount: number;
  unrealizedPnL: number;
};

export type BudgetBatch = {
  id: number;
  weeklyPay: number;
  submittedAt: string;
  notes: string | null;
  items: Array<{ accountId: number; percent: number; amount: number }>;
};

export type DashboardInitialData = {
  summary: DashboardSummary;
  accounts: Account[];
  transactions: Transaction[];
  bills: Bill[];
  budgetBatches: BudgetBatch[];
  snapshotSeries: { date: string; totalValue: number }[];
};
