import { prisma } from "@/lib/db/prisma";
import { apiError, apiOk } from "@/lib/api/contracts";
import { parseBody, parseIntParam } from "@/lib/api/request";
import { transactionPatchSchema } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsedId = parseIntParam(id, "transaction id");
  if (parsedId.error) {
    return parsedId.error;
  }
  const txn = await prisma.transaction.findUnique({ where: { id: parsedId.data } });
  if (!txn) {
    return apiError("NOT_FOUND", "Transaction not found.", 404);
  }
  return apiOk(txn);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsedId = parseIntParam(id, "transaction id");
  if (parsedId.error) {
    return parsedId.error;
  }
  const parsed = await parseBody(req, transactionPatchSchema);
  if (parsed.error) {
    return parsed.error;
  }
  const body = parsed.data;

  const existing = await prisma.transaction.findUnique({ where: { id: parsedId.data } });
  if (!existing) {
    return apiError("NOT_FOUND", "Transaction not found.", 404);
  }

  const updated = await prisma.transaction.update({
    where: { id: parsedId.data },
    data: {
      ...(body.date !== undefined
        ? {
            date: new Date(body.date),
            yearMonth: new Date(body.date).toISOString().slice(0, 7),
          }
        : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.amount !== undefined ? { amount: body.amount } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.source !== undefined ? { source: body.source } : {}),
      ...(body.fromAccountId !== undefined ? { fromAccountId: body.fromAccountId } : {}),
      ...(body.toAccountId !== undefined ? { toAccountId: body.toAccountId } : {}),
      ...(body.billId !== undefined ? { billId: body.billId } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
  });

  return apiOk(updated);
}

export async function DELETE(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsedId = parseIntParam(id, "transaction id");
  if (parsedId.error) {
    return parsedId.error;
  }
  const existing = await prisma.transaction.findUnique({ where: { id: parsedId.data } });
  if (!existing) {
    return apiError("NOT_FOUND", "Transaction not found.", 404);
  }
  await prisma.transaction.delete({ where: { id: parsedId.data } });
  return apiOk({ deleted: true });
}
