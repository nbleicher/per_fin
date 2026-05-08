import { prisma } from "@/lib/db/prisma";
import { apiError, apiOk, parsePagination } from "@/lib/api/contracts";
import { parseBody } from "@/lib/api/request";
import { z } from "zod";

const categoryCreateSchema = z.object({
  portfolioId: z.number().int().positive(),
  name: z.string().trim().min(1),
  targetWeight: z.number().min(0).max(100),
});

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
    prisma.portfolioCategory.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { id: "asc" },
    }),
    prisma.portfolioCategory.count({ where }),
  ]);
  return apiOk(items, {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, categoryCreateSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;
  const created = await prisma.portfolioCategory.create({
    data: {
      portfolioId: body.portfolioId,
      name: body.name,
      targetWeight: body.targetWeight,
    },
  });
  return apiOk(created, undefined, 201);
}
