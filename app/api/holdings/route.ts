import { prisma } from "@/lib/db/prisma";
import { apiError, apiOk, parsePagination } from "@/lib/api/contracts";
import { parseBody } from "@/lib/api/request";
import { holdingCreateSchema } from "@/lib/validation/schemas";

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
    prisma.holding.findMany({ where, skip, take: pageSize, orderBy: { id: "asc" } }),
    prisma.holding.count({ where }),
  ]);
  return apiOk(items, {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, holdingCreateSchema);
  if (parsed.error) {
    return parsed.error;
  }
  const body = parsed.data;
  const created = await prisma.holding.create({
    data: {
      portfolioId: body.portfolioId,
      symbol: body.symbol,
      name: body.name ?? null,
      shares: body.shares,
      averageCost: body.averageCost,
      currentPrice: body.currentPrice ?? null,
      categoryName: body.categoryName ?? null,
    },
  });
  return apiOk(created, undefined, 201);
}
