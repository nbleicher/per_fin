import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/contracts";
import { prisma } from "@/lib/db/prisma";
import {
  accountCreateSchema,
  billCreateSchema,
  transactionCreateSchema,
} from "@/lib/validation/schemas";

const transactionDraftSchema = transactionCreateSchema.partial().extend({
  description: z.string().trim().min(1),
  amount: z.number().positive(),
});

const accountDraftSchema = accountCreateSchema
  .partial()
  .extend({
    name: z.string().trim().min(1),
    accountSubtype: z.enum(["CHECKING", "SAVINGS", "CREDIT", "LOAN", "INVESTMENT"]),
  });

const billDraftSchema = billCreateSchema
  .partial()
  .extend({
    name: z.string().trim().min(1),
    defaultAmount: z.number().min(0),
    dueDay: z.number().int().min(1).max(31),
  });

const payloadSchema = z.object({
  replaceExisting: z.boolean().default(false),
  transactions: z.array(transactionDraftSchema).default([]),
  accounts: z.array(accountDraftSchema).default([]),
  bills: z.array(billDraftSchema).default([]),
});

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid apply payload.", 422, parsed.error.flatten());
  }

  const { transactions, accounts, bills, replaceExisting } = parsed.data;

  let createdAccounts = 0;
  let updatedAccounts = 0;
  let createdBills = 0;
  let updatedBills = 0;
  let createdTransactions = 0;
  let updatedTransactions = 0;

  for (const draft of accounts) {
    const existing = await prisma.account.findFirst({
      where: { name: { equals: draft.name, mode: "insensitive" } },
    });
    if (existing && replaceExisting) {
      await prisma.account.update({
        where: { id: existing.id },
        data: {
          ownerType: draft.ownerType ?? existing.ownerType,
          accountSubtype: draft.accountSubtype ?? existing.accountSubtype,
          annualRatePercent: draft.annualRatePercent ?? existing.annualRatePercent,
          isActive: draft.isActive ?? existing.isActive,
        },
      });
      updatedAccounts += 1;
      continue;
    }
    if (!existing) {
      await prisma.account.create({
        data: {
          name: draft.name,
          ownerType: draft.ownerType ?? "PERSONAL",
          accountSubtype: draft.accountSubtype,
          annualRatePercent: draft.annualRatePercent ?? null,
          startingBalance: draft.startingBalance ?? 0,
          startingDate: draft.startingDate ? new Date(draft.startingDate) : null,
          isActive: draft.isActive ?? true,
        },
      });
      createdAccounts += 1;
    }
  }

  for (const draft of bills) {
    const existing = await prisma.bill.findFirst({
      where: { name: { equals: draft.name, mode: "insensitive" } },
    });
    if (existing && replaceExisting) {
      await prisma.bill.update({
        where: { id: existing.id },
        data: {
          defaultAmount: draft.defaultAmount ?? existing.defaultAmount,
          dueDay: draft.dueDay ?? existing.dueDay,
          category: draft.category ?? existing.category,
          active: draft.active ?? existing.active,
          defaultFromAccountId: draft.defaultFromAccountId ?? existing.defaultFromAccountId,
          defaultToAccountId: draft.defaultToAccountId ?? existing.defaultToAccountId,
        },
      });
      updatedBills += 1;
      continue;
    }
    if (!existing) {
      await prisma.bill.create({
        data: {
          name: draft.name,
          defaultAmount: draft.defaultAmount,
          dueDay: draft.dueDay,
          dueGroup: draft.dueGroup ?? null,
          category: draft.category ?? null,
          active: draft.active ?? true,
          defaultFromAccountId: draft.defaultFromAccountId ?? null,
          defaultToAccountId: draft.defaultToAccountId ?? null,
        },
      });
      createdBills += 1;
    }
  }

  for (const draft of transactions) {
    const date = draft.date ? new Date(draft.date) : new Date();
    const yearMonth = date.toISOString().slice(0, 7);
    const existing = await prisma.transaction.findFirst({
      where: {
        date,
        description: draft.description,
        amount: draft.amount,
      },
    });
    if (existing && replaceExisting) {
      await prisma.transaction.update({
        where: { id: existing.id },
        data: {
          type: draft.type ?? existing.type,
          source: draft.source ?? existing.source,
          fromAccountId: draft.fromAccountId ?? existing.fromAccountId,
          toAccountId: draft.toAccountId ?? existing.toAccountId,
          billId: draft.billId ?? existing.billId,
          category: draft.category ?? existing.category,
          notes: draft.notes ?? existing.notes,
        },
      });
      updatedTransactions += 1;
      continue;
    }
    if (!existing) {
      await prisma.transaction.create({
        data: {
          date,
          yearMonth,
          description: draft.description,
          amount: draft.amount,
          type: draft.type ?? "EXPENSE",
          source: draft.source ?? "IMPORT",
          fromAccountId: draft.fromAccountId ?? null,
          toAccountId: draft.toAccountId ?? null,
          billId: draft.billId ?? null,
          category: draft.category ?? null,
          notes: draft.notes ?? null,
        },
      });
      createdTransactions += 1;
    }
  }

  return apiOk({
    createdAccounts,
    updatedAccounts,
    createdBills,
    updatedBills,
    createdTransactions,
    updatedTransactions,
  });
}

