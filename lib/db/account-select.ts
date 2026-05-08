import type { Prisma } from "@prisma/client";

export const accountDomainSelect = {
  id: true,
  name: true,
  ownerType: true,
  accountSubtype: true,
  annualRatePercent: true,
  limitAmount: true,
  startingBalance: true,
  startingDate: true,
  isActive: true,
} satisfies Prisma.AccountSelect;
