import type { Prisma } from "@prisma/client";

/** Fields returned by list/read APIs matching [`Transaction`](lib/types/domain.ts). */
export const transactionDomainSelect = {
  id: true,
  date: true,
  yearMonth: true,
  description: true,
  amount: true,
  type: true,
  source: true,
  fromAccountId: true,
  toAccountId: true,
  billId: true,
  category: true,
  notes: true,
} satisfies Prisma.TransactionSelect;

/** Minimal columns for [`computeDashboardSummary`](lib/finance/dashboard-summary.ts). */
export const transactionSummarySelect = {
  id: true,
  amount: true,
  type: true,
  yearMonth: true,
  fromAccountId: true,
  toAccountId: true,
} satisfies Prisma.TransactionSelect;
