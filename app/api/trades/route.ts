import { prisma } from "@/lib/db/prisma";
import { apiError, apiOk, parsePagination } from "@/lib/api/contracts";
import { parseBody } from "@/lib/api/request";
import { tradeCreateSchema } from "@/lib/validation/schemas";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { page, pageSize, skip } = parsePagination(url.searchParams);
  const portfolioIdParam = url.searchParams.get("portfolioId");
  const portfolioId = portfolioIdParam ? Number.parseInt(portfolioIdParam, 10) : undefined;
  if (
    portfolioIdParam &&
    (portfolioId === undefined || !Number.isInteger(portfolioId) || portfolioId <= 0)
  ) {
    return apiError("VALIDATION_ERROR", "portfolioId must be a positive integer.", 422);
  }
  const where = portfolioId !== undefined ? { portfolioId } : {};
  const [items, total] = await Promise.all([
    prisma.trade.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ tradeDate: "desc" }, { id: "desc" }],
    }),
    prisma.trade.count({ where }),
  ]);
  return apiOk(items, {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, tradeCreateSchema);
  if (parsed.error) {
    return parsed.error;
  }
  const body = parsed.data;
  const created = await prisma.trade.create({
    data: {
      portfolioId: body.portfolioId,
      symbol: body.symbol,
      tradeType: body.tradeType,
      shares: body.shares,
      price: body.price,
      fee: body.fee,
      tradeDate: new Date(body.tradeDate),
      notes: body.notes ?? null,
    },
  });
  return apiOk(created, undefined, 201);
}
