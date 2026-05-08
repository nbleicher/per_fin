import { prisma } from "@/lib/db/prisma";
import { apiError, apiOk, parsePagination } from "@/lib/api/contracts";
import { parseBody } from "@/lib/api/request";
import { dividendCreateSchema } from "@/lib/validation/schemas";

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
    prisma.dividend.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ payDate: "desc" }, { id: "desc" }],
    }),
    prisma.dividend.count({ where }),
  ]);
  return apiOk(items, {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, dividendCreateSchema);
  if (parsed.error) {
    return parsed.error;
  }
  const body = parsed.data;
  const created = await prisma.dividend.create({
    data: {
      portfolioId: body.portfolioId,
      symbol: body.symbol,
      amount: body.amount,
      payDate: new Date(body.payDate),
      notes: body.notes ?? null,
    },
  });
  return apiOk(created, undefined, 201);
}
