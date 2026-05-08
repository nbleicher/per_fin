import { prisma } from "@/lib/db/prisma";
import { apiOk } from "@/lib/api/contracts";
import { parseBody } from "@/lib/api/request";
import { fireSettingsSchema } from "@/lib/validation/schemas";

export async function GET() {
  const settings =
    (await prisma.fireSettings.findUnique({ where: { id: 1 } })) ??
    (await prisma.fireSettings.create({ data: { id: 1 } }));
  return apiOk(settings);
}

export async function PUT(req: Request) {
  const parsed = await parseBody(req, fireSettingsSchema);
  if (parsed.error) {
    return parsed.error;
  }
  const body = parsed.data;

  const updated = await prisma.fireSettings.upsert({
    where: { id: 1 },
    update: {
      currentAge: body.currentAge,
      projectedAnnualIncome: body.projectedAnnualIncome,
      annualSpending: body.annualSpending,
      expectedReturnPct: body.expectedReturnPct,
      inflationPct: body.inflationPct,
      swrPct: body.swrPct,
      contributionOverride: body.contributionOverride ?? null,
    },
    create: {
      id: 1,
      currentAge: body.currentAge,
      projectedAnnualIncome: body.projectedAnnualIncome,
      annualSpending: body.annualSpending,
      expectedReturnPct: body.expectedReturnPct,
      inflationPct: body.inflationPct,
      swrPct: body.swrPct,
      contributionOverride: body.contributionOverride ?? null,
    },
  });

  return apiOk(updated);
}
