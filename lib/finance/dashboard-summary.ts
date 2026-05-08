import type { AccountSubtype } from "@prisma/client";

function isAsset(subtype: AccountSubtype) {
  return (
    subtype === "CHECKING" ||
    subtype === "SAVINGS" ||
    subtype === "INVESTMENT"
  );
}

type SummaryAccount = {
  id: number;
  accountSubtype: AccountSubtype;
  startingBalance: number | null;
};

type SummaryTxn = {
  amount: number;
  type: string;
  yearMonth: string;
  fromAccountId: number | null;
  toAccountId: number | null;
};

export type DashboardSummaryMetrics = {
  netWorth: number;
  assets: number;
  liabilities: number;
  monthIncome: number;
  monthExpenses: number;
  monthTransfers: number;
  accountCount: number;
  transactionCount: number;
};

/** Rolling balances + net worth / month aggregates (matches legacy `/api/dashboard/summary` behavior). */
export function computeDashboardSummary(
  accounts: SummaryAccount[],
  transactions: SummaryTxn[],
): DashboardSummaryMetrics {
  const balances = new Map<number, number>();
  for (const account of accounts) {
    balances.set(account.id, account.startingBalance ?? 0);
  }

  for (const txn of transactions) {
    if (txn.fromAccountId) {
      const from = accounts.find((account) => account.id === txn.fromAccountId);
      if (from) {
        const current = balances.get(from.id) ?? 0;
        balances.set(
          from.id,
          isAsset(from.accountSubtype) ? current - txn.amount : current + txn.amount,
        );
      }
    }
    if (txn.toAccountId) {
      const to = accounts.find((account) => account.id === txn.toAccountId);
      if (to) {
        const current = balances.get(to.id) ?? 0;
        balances.set(
          to.id,
          isAsset(to.accountSubtype) ? current + txn.amount : current - txn.amount,
        );
      }
    }
  }

  let assets = 0;
  let liabilities = 0;
  for (const account of accounts) {
    const balance = balances.get(account.id) ?? 0;
    if (isAsset(account.accountSubtype)) assets += balance;
    else liabilities += balance;
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthTransactions = transactions.filter((txn) => txn.yearMonth === currentMonth);
  const monthIncome = monthTransactions
    .filter((txn) => txn.type === "INCOME")
    .reduce((sum, txn) => sum + txn.amount, 0);
  const monthExpenses = monthTransactions
    .filter((txn) => txn.type === "EXPENSE")
    .reduce((sum, txn) => sum + txn.amount, 0);
  const monthTransfers = monthTransactions
    .filter((txn) => txn.type === "TRANSFER")
    .reduce((sum, txn) => sum + txn.amount, 0);

  return {
    netWorth: assets - liabilities,
    assets,
    liabilities,
    monthIncome,
    monthExpenses,
    monthTransfers,
    accountCount: accounts.length,
    transactionCount: transactions.length,
  };
}
