import { prisma } from "@/lib/db/prisma";
import { apiError, apiOk } from "@/lib/api/contracts";
import { parseIntParam } from "@/lib/api/request";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsedId = parseIntParam(id, "holding id");
  if (parsedId.error) return parsedId.error;
  const existing = await prisma.holding.findUnique({ where: { id: parsedId.data } });
  if (!existing) return apiError("NOT_FOUND", "Holding not found.", 404);
  await prisma.holding.delete({ where: { id: parsedId.data } });
  return apiOk({ deleted: true });
}
