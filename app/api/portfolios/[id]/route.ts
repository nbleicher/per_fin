import { prisma } from "@/lib/db/prisma";
import { apiError, apiOk } from "@/lib/api/contracts";
import { parseIntParam } from "@/lib/api/request";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsedId = parseIntParam(id, "portfolio id");
  if (parsedId.error) return parsedId.error;
  const portfolio = await prisma.portfolio.findUnique({ where: { id: parsedId.data } });
  if (!portfolio) return apiError("NOT_FOUND", "Portfolio not found.", 404);
  return apiOk(portfolio);
}

export async function DELETE(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsedId = parseIntParam(id, "portfolio id");
  if (parsedId.error) return parsedId.error;
  const existing = await prisma.portfolio.findUnique({ where: { id: parsedId.data } });
  if (!existing) return apiError("NOT_FOUND", "Portfolio not found.", 404);
  await prisma.portfolio.delete({ where: { id: parsedId.data } });
  return apiOk({ deleted: true });
}
