import { computeDashboardSummary } from "@/lib/finance/dashboard-summary";
import { prisma } from "@/lib/db/prisma";
import { transactionSummarySelect } from "@/lib/db/transaction-select";
import { apiOk } from "@/lib/api/contracts";

export async function GET() {
  const [accounts, transactions] = await Promise.all([
    prisma.account.findMany({
      where: { isActive: true },
      select: { id: true, accountSubtype: true, startingBalance: true },
    }),
    prisma.transaction.findMany({
      orderBy: [{ date: "asc" }, { id: "asc" }],
      select: transactionSummarySelect,
    }),
  ]);

  return apiOk(computeDashboardSummary(accounts, transactions));
}
