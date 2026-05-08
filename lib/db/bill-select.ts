import type { Prisma } from "@prisma/client";

export const billDomainSelect = {
  id: true,
  name: true,
  defaultAmount: true,
  dueDay: true,
  dueGroup: true,
  category: true,
  active: true,
  defaultFromAccountId: true,
  defaultToAccountId: true,
} satisfies Prisma.BillSelect;
