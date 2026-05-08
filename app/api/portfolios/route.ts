import { prisma } from "@/lib/db/prisma";
import { apiOk, parsePagination } from "@/lib/api/contracts";
import { parseBody } from "@/lib/api/request";
import { portfolioCreateSchema } from "@/lib/validation/schemas";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { page, pageSize, skip } = parsePagination(url.searchParams);
  const [items, total] = await Promise.all([
    prisma.portfolio.findMany({
      skip,
      take: pageSize,
      orderBy: { id: "asc" },
    }),
    prisma.portfolio.count(),
  ]);
  return apiOk(items, {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, portfolioCreateSchema);
  if (parsed.error) {
    return parsed.error;
  }
  const body = parsed.data;
  const created = await prisma.portfolio.create({
    data: {
      name: body.name,
      description: body.description ?? null,
    },
  });
  return apiOk(created, undefined, 201);
}
