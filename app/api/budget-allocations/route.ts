import { prisma } from "@/lib/db/prisma";
import { apiError, apiOk } from "@/lib/api/contracts";
import { parseBody } from "@/lib/api/request";
import { z } from "zod";

const allocationSchema = z.object({
  accountId: z.number().int().positive(),
  percent: z.number().positive().max(100),
});

const budgetAllocationCreateSchema = z.object({
  weeklyPay: z.number().positive(),
  notes: z.string().trim().nullable().optional(),
  allocations: z.array(allocationSchema).min(1),
});

export async function GET() {
  const batches = await prisma.budgetAllocationBatch.findMany({
    orderBy: { submittedAt: "desc" },
    take: 20,
    include: { items: true },
  });
  return apiOk(batches);
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, budgetAllocationCreateSchema);
  if (parsed.error) {
    return parsed.error;
  }
  const body = parsed.data;

  const totalPercent = body.allocations.reduce((sum, row) => sum + row.percent, 0);
  if (totalPercent > 100) {
    return apiError("VALIDATION_ERROR", "Allocation percentage total must be 100 or less.", 422);
  }

  const accountIds = [...new Set(body.allocations.map((row) => row.accountId))];
  const existingAccounts = await prisma.account.findMany({
    where: { id: { in: accountIds }, isActive: true },
    select: { id: true },
  });
  if (existingAccounts.length !== accountIds.length) {
    return apiError("VALIDATION_ERROR", "One or more allocation accounts are invalid.", 422);
  }

  const now = new Date();
  const yearMonth = now.toISOString().slice(0, 7);

  const result = await prisma.$transaction(async (tx) => {
    const batch = await tx.budgetAllocationBatch.create({
      data: {
        weeklyPay: body.weeklyPay,
        notes: body.notes ?? null,
      },
    });

    const items = [];
    const createdTransactions = [];
    for (const row of body.allocations) {
      const amount = Number(((body.weeklyPay * row.percent) / 100).toFixed(2));
      const item = await tx.budgetAllocationItem.create({
        data: {
          batchId: batch.id,
          accountId: row.accountId,
          percent: row.percent,
          amount,
        },
      });
      items.push(item);
      const txn = await tx.transaction.create({
        data: {
          date: now,
          yearMonth,
          description: `Weekly pay allocation ${row.percent}%`,
          amount,
          type: "INCOME",
          source: "ALLOCATION",
          toAccountId: row.accountId,
        },
      });
      createdTransactions.push(txn);
    }

    return { batch, items, createdTransactions };
  });

  return apiOk(
    {
      ...result,
      totals: {
        percent: totalPercent,
        allocatedAmount: result.items.reduce((sum, row) => sum + row.amount, 0),
      },
    },
    undefined,
    201,
  );
}
