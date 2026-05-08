import { prisma } from "@/lib/db/prisma";
import { apiOk, parsePagination } from "@/lib/api/contracts";
import { parseBody } from "@/lib/api/request";
import { strategyItemCreateSchema } from "@/lib/validation/schemas";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { page, pageSize, skip } = parsePagination(url.searchParams);
  const [items, total] = await Promise.all([
    prisma.strategyItem.findMany({
      skip,
      take: pageSize,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    prisma.strategyItem.count(),
  ]);
  return apiOk(items, {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, strategyItemCreateSchema);
  if (parsed.error) {
    return parsed.error;
  }
  const body = parsed.data;
  const created = await prisma.strategyItem.create({
    data: {
      title: body.title,
      description: body.description ?? null,
      status: body.status,
      targetDate: body.targetDate ? new Date(body.targetDate) : null,
    },
  });
  return apiOk(created, undefined, 201);
}
