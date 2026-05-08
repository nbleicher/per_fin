import { prisma } from "@/lib/db/prisma";
import { apiOk } from "@/lib/api/contracts";
import { logger } from "@/lib/observability/logger";

export async function GET() {
  const [
    accounts,
    transactions,
    bills,
    portfolios,
    holdings,
    trades,
    dividends,
    categories,
    snapshots,
    fireSettings,
    strategyItems,
    allocationBatches,
  ] = await Promise.all([
    prisma.account.findMany(),
    prisma.transaction.findMany(),
    prisma.bill.findMany(),
    prisma.portfolio.findMany(),
    prisma.holding.findMany(),
    prisma.trade.findMany(),
    prisma.dividend.findMany(),
    prisma.portfolioCategory.findMany(),
    prisma.portfolioSnapshot.findMany(),
    prisma.fireSettings.findMany(),
    prisma.strategyItem.findMany(),
    prisma.budgetAllocationBatch.findMany({ include: { items: true } }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    accounts,
    transactions,
    bills,
    portfolios,
    holdings,
    trades,
    dividends,
    categories,
    snapshots,
    fireSettings,
    strategyItems,
    allocationBatches,
  };

  logger.info("settings_export_generated", {
    accountCount: accounts.length,
    transactionCount: transactions.length,
  });

  return apiOk(payload);
}
