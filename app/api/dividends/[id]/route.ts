import { prisma } from "@/lib/db/prisma";
import { apiError, apiOk } from "@/lib/api/contracts";
import { parseIntParam } from "@/lib/api/request";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsedId = parseIntParam(id, "dividend id");
  if (parsedId.error) return parsedId.error;
  const existing = await prisma.dividend.findUnique({ where: { id: parsedId.data } });
  if (!existing) return apiError("NOT_FOUND", "Dividend not found.", 404);
  await prisma.dividend.delete({ where: { id: parsedId.data } });
  return apiOk({ deleted: true });
}
