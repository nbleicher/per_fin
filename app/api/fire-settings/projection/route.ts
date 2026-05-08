import { apiError, apiOk } from "@/lib/api/contracts";
import { parseBody } from "@/lib/api/request";
import { fireSettingsSchema } from "@/lib/validation/schemas";
import { z } from "zod";

const projectionSchema = z.object({
  settings: fireSettingsSchema,
  currentNetWorth: z.number().min(0).default(0),
});

function computedAnnualSavings(projectedAnnualIncome: number, annualSpending: number) {
  return Math.max(0, Math.round((projectedAnnualIncome - annualSpending) * 100) / 100);
}

type FirePoint = {
  yearOffset: number;
  age: number;
  projectedNetWorth: number;
  fireTarget: number;
  progressPct: number;
};

function projectFireTimeline(
  currentAge: number,
  annualSpending: number,
  expectedReturnPct: number,
  inflationPct: number,
  swrPct: number,
  annualContribution: number,
  currentNetWorth: number,
): { points: FirePoint[]; yearsToFire: number; fireAge: number; progressPct: number } {
  const points: FirePoint[] = [];
  const maxYears = 80;
  let netWorth = currentNetWorth;
  let yearsToFire = maxYears;

  for (let year = 0; year <= maxYears; year += 1) {
    const spendingAtYear = annualSpending * Math.pow(1 + inflationPct / 100, year);
    const fireTarget = spendingAtYear / (swrPct / 100);
    const progressPct = fireTarget <= 0 ? 0 : Math.min(100, (netWorth / fireTarget) * 100);

    points.push({
      yearOffset: year,
      age: currentAge + year,
      projectedNetWorth: netWorth,
      fireTarget,
      progressPct,
    });

    if (netWorth >= fireTarget) {
      yearsToFire = year;
      break;
    }

    netWorth = netWorth * (1 + expectedReturnPct / 100) + annualContribution;
  }

  return {
    points,
    yearsToFire,
    fireAge: currentAge + yearsToFire,
    progressPct: points[0]?.progressPct ?? 0,
  };
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, projectionSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const settings = body.settings;
  const fromIncomeExpenses = computedAnnualSavings(settings.projectedAnnualIncome, settings.annualSpending);
  const annualContribution =
    typeof settings.contributionOverride === "number"
      ? settings.contributionOverride
      : fromIncomeExpenses;
  if (annualContribution < 0) {
    return apiError("VALIDATION_ERROR", "Contribution cannot be negative.", 422);
  }

  const projection = projectFireTimeline(
    settings.currentAge,
    settings.annualSpending,
    settings.expectedReturnPct,
    settings.inflationPct,
    settings.swrPct,
    annualContribution,
    body.currentNetWorth,
  );

  return apiOk({
    yearsToFire: projection.yearsToFire,
    fireAge: projection.fireAge,
    progressPct: projection.progressPct,
    points: projection.points,
  });
}
