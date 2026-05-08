import { prisma } from "@/lib/db/prisma";
import { apiError, apiOk } from "@/lib/api/contracts";
import { parseBody, parseIntParam } from "@/lib/api/request";
import { billPatchSchema } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsedId = parseIntParam(id, "bill id");
  if (parsedId.error) {
    return parsedId.error;
  }
  const bill = await prisma.bill.findUnique({ where: { id: parsedId.data } });
  if (!bill) {
    return apiError("NOT_FOUND", "Bill not found.", 404);
  }
  return apiOk(bill);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsedId = parseIntParam(id, "bill id");
  if (parsedId.error) {
    return parsedId.error;
  }

  const parsed = await parseBody(req, billPatchSchema);
  if (parsed.error) {
    return parsed.error;
  }
  const body = parsed.data;

  const existing = await prisma.bill.findUnique({ where: { id: parsedId.data } });
  if (!existing) {
    return apiError("NOT_FOUND", "Bill not found.", 404);
  }

  const updated = await prisma.bill.update({
    where: { id: parsedId.data },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.defaultAmount !== undefined ? { defaultAmount: body.defaultAmount } : {}),
      ...(body.dueDay !== undefined ? { dueDay: body.dueDay } : {}),
      ...(body.dueGroup !== undefined ? { dueGroup: body.dueGroup } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
      ...(body.defaultFromAccountId !== undefined
        ? { defaultFromAccountId: body.defaultFromAccountId }
        : {}),
      ...(body.defaultToAccountId !== undefined
        ? { defaultToAccountId: body.defaultToAccountId }
        : {}),
    },
  });
  return apiOk(updated);
}

export async function DELETE(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsedId = parseIntParam(id, "bill id");
  if (parsedId.error) {
    return parsedId.error;
  }
  const existing = await prisma.bill.findUnique({ where: { id: parsedId.data } });
  if (!existing) {
    return apiError("NOT_FOUND", "Bill not found.", 404);
  }
  await prisma.bill.delete({ where: { id: parsedId.data } });
  return apiOk({ deleted: true });
}
