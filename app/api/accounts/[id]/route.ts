import { prisma } from "@/lib/db/prisma";
import { apiError, apiOk } from "@/lib/api/contracts";
import { parseBody, parseIntParam } from "@/lib/api/request";
import { accountPatchSchema } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsedId = parseIntParam(id, "account id");
  if (parsedId.error) {
    return parsedId.error;
  }
  const account = await prisma.account.findUnique({
    where: { id: parsedId.data },
  });
  if (!account) {
    return apiError("NOT_FOUND", "Account not found.", 404);
  }
  return apiOk(account);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsedId = parseIntParam(id, "account id");
  if (parsedId.error) {
    return parsedId.error;
  }

  const parsed = await parseBody(req, accountPatchSchema);
  if (parsed.error) {
    return parsed.error;
  }
  const body = parsed.data;

  const existing = await prisma.account.findUnique({ where: { id: parsedId.data } });
  if (!existing) {
    return apiError("NOT_FOUND", "Account not found.", 404);
  }

  const updated = await prisma.account.update({
    where: { id: parsedId.data },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.ownerType !== undefined ? { ownerType: body.ownerType } : {}),
      ...(body.accountSubtype !== undefined ? { accountSubtype: body.accountSubtype } : {}),
      ...(body.annualRatePercent !== undefined
        ? { annualRatePercent: body.annualRatePercent }
        : {}),
      ...(body.limitAmount !== undefined ? { limitAmount: body.limitAmount } : {}),
      ...(body.startingBalance !== undefined ? { startingBalance: body.startingBalance } : {}),
      ...(body.startingDate !== undefined
        ? { startingDate: body.startingDate ? new Date(body.startingDate) : null }
        : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  });

  return apiOk(updated);
}

export async function DELETE(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsedId = parseIntParam(id, "account id");
  if (parsedId.error) {
    return parsedId.error;
  }

  const existing = await prisma.account.findUnique({ where: { id: parsedId.data } });
  if (!existing) {
    return apiError("NOT_FOUND", "Account not found.", 404);
  }

  await prisma.account.delete({ where: { id: parsedId.data } });
  return apiOk({ deleted: true });
}
