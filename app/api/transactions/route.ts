import { prisma } from "@/lib/db/prisma";
import { transactionDomainSelect } from "@/lib/db/transaction-select";
import { apiError, apiOk, parsePagination } from "@/lib/api/contracts";
import { parseBody } from "@/lib/api/request";
import { transactionCreateSchema, transactionTypeSchema } from "@/lib/validation/schemas";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { page, pageSize, skip } = parsePagination(url.searchParams);
  const accountIdParam = url.searchParams.get("accountId");
  const typeParam = url.searchParams.get("type");
  const month = url.searchParams.get("month");
  const search = url.searchParams.get("search");

  const accountId = accountIdParam ? Number.parseInt(accountIdParam, 10) : undefined;
  if (accountIdParam && (accountId === undefined || !Number.isInteger(accountId) || accountId <= 0)) {
    return apiError("VALIDATION_ERROR", "accountId must be a positive integer.", 422);
  }

  const type = typeParam ? transactionTypeSchema.safeParse(typeParam.toUpperCase()) : null;
  if (type && !type.success) {
    return apiError("VALIDATION_ERROR", "Invalid transaction type.", 422, type.error.flatten());
  }

  const where = {
    ...(type?.success ? { type: type.data } : {}),
    ...(month ? { yearMonth: month } : {}),
    ...(search
      ? {
          OR: [
            { description: { contains: search } },
            { notes: { contains: search } },
            { category: { contains: search } },
          ],
        }
      : {}),
    ...(accountId !== undefined
      ? {
          OR: [{ fromAccountId: accountId }, { toAccountId: accountId }],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      select: transactionDomainSelect,
    }),
    prisma.transaction.count({ where }),
  ]);

  return apiOk(items, {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, transactionCreateSchema);
  if (parsed.error) {
    return parsed.error;
  }
  const body = parsed.data;
  const date = new Date(body.date);
  const yearMonth = date.toISOString().slice(0, 7);

  const created = await prisma.transaction.create({
    data: {
      date,
      yearMonth,
      description: body.description,
      amount: body.amount,
      type: body.type,
      source: body.source,
      fromAccountId: body.fromAccountId ?? null,
      toAccountId: body.toAccountId ?? null,
      billId: body.billId ?? null,
      category: body.category ?? null,
      notes: body.notes ?? null,
    },
  });

  return apiOk(created, undefined, 201);
}
