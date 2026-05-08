import { prisma } from "@/lib/db/prisma";
import { accountDomainSelect } from "@/lib/db/account-select";
import { apiError, apiOk, parsePagination } from "@/lib/api/contracts";
import { parseBody } from "@/lib/api/request";
import {
  accountCreateSchema,
  accountSubtypeSchema,
  ownerTypeSchema,
} from "@/lib/validation/schemas";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { page, pageSize, skip } = parsePagination(url.searchParams);
  const ownerTypeParam = url.searchParams.get("ownerType");
  const subtypeParam = url.searchParams.get("accountSubtype");

  const ownerType = ownerTypeParam
    ? ownerTypeSchema.safeParse(ownerTypeParam.toUpperCase())
    : null;
  if (ownerType && !ownerType.success) {
    return apiError("VALIDATION_ERROR", "Invalid ownerType.", 422, ownerType.error.flatten());
  }

  const subtype = subtypeParam
    ? accountSubtypeSchema.safeParse(subtypeParam.toUpperCase())
    : null;
  if (subtype && !subtype.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Invalid accountSubtype.",
      422,
      subtype.error.flatten(),
    );
  }

  const where = {
    ...(ownerType?.success ? { ownerType: ownerType.data } : {}),
    ...(subtype?.success ? { accountSubtype: subtype.data } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.account.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { id: "asc" },
      select: accountDomainSelect,
    }),
    prisma.account.count({ where }),
  ]);

  return apiOk(items, {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, accountCreateSchema);
  if (parsed.error) {
    return parsed.error;
  }
  const body = parsed.data;

  const created = await prisma.account.create({
    data: {
      name: body.name,
      ownerType: body.ownerType,
      accountSubtype: body.accountSubtype,
      annualRatePercent: body.annualRatePercent ?? null,
      limitAmount: body.limitAmount ?? null,
      startingBalance: body.startingBalance,
      startingDate: body.startingDate ? new Date(body.startingDate) : null,
      isActive: body.isActive,
    },
  });

  return apiOk(created, undefined, 201);
}
