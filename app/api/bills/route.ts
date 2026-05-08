import { prisma } from "@/lib/db/prisma";
import { billDomainSelect } from "@/lib/db/bill-select";
import { apiOk, parsePagination } from "@/lib/api/contracts";
import { parseBody } from "@/lib/api/request";
import { billCreateSchema } from "@/lib/validation/schemas";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { page, pageSize, skip } = parsePagination(url.searchParams);
  const activeParam = url.searchParams.get("active");
  const active =
    activeParam === null ? undefined : activeParam === "true" ? true : activeParam === "false" ? false : undefined;
  const where = active === undefined ? {} : { active };

  const [items, total] = await Promise.all([
    prisma.bill.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ dueDay: "asc" }, { id: "asc" }],
      select: billDomainSelect,
    }),
    prisma.bill.count({ where }),
  ]);

  return apiOk(items, {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, billCreateSchema);
  if (parsed.error) {
    return parsed.error;
  }
  const body = parsed.data;
  const created = await prisma.bill.create({
    data: {
      name: body.name,
      defaultAmount: body.defaultAmount,
      dueDay: body.dueDay,
      dueGroup: body.dueGroup ?? null,
      category: body.category ?? null,
      active: body.active,
      defaultFromAccountId: body.defaultFromAccountId ?? null,
      defaultToAccountId: body.defaultToAccountId ?? null,
    },
  });
  return apiOk(created, undefined, 201);
}
