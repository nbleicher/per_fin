import { prisma } from "@/lib/db/prisma";
import { apiError, apiOk } from "@/lib/api/contracts";
import { parseBody, parseIntParam } from "@/lib/api/request";
import { strategyItemCreateSchema } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsedId = parseIntParam(id, "strategy item id");
  if (parsedId.error) return parsedId.error;
  const item = await prisma.strategyItem.findUnique({ where: { id: parsedId.data } });
  if (!item) return apiError("NOT_FOUND", "Strategy item not found.", 404);
  return apiOk(item);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsedId = parseIntParam(id, "strategy item id");
  if (parsedId.error) return parsedId.error;
  const parsed = await parseBody(req, strategyItemCreateSchema.partial());
  if (parsed.error) return parsed.error;
  const body = parsed.data;
  const existing = await prisma.strategyItem.findUnique({ where: { id: parsedId.data } });
  if (!existing) return apiError("NOT_FOUND", "Strategy item not found.", 404);
  const updated = await prisma.strategyItem.update({
    where: { id: parsedId.data },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.targetDate !== undefined
        ? { targetDate: body.targetDate ? new Date(body.targetDate) : null }
        : {}),
    },
  });
  return apiOk(updated);
}

export async function DELETE(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsedId = parseIntParam(id, "strategy item id");
  if (parsedId.error) return parsedId.error;
  const existing = await prisma.strategyItem.findUnique({ where: { id: parsedId.data } });
  if (!existing) return apiError("NOT_FOUND", "Strategy item not found.", 404);
  await prisma.strategyItem.delete({ where: { id: parsedId.data } });
  return apiOk({ deleted: true });
}
