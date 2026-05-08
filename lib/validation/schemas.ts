import { z } from "zod";

export const ownerTypeSchema = z.enum(["PERSONAL", "BUSINESS"]);
export const accountSubtypeSchema = z.enum([
  "CHECKING",
  "SAVINGS",
  "CREDIT",
  "LOAN",
  "INVESTMENT",
]);
export const transactionTypeSchema = z.enum(["INCOME", "EXPENSE", "TRANSFER"]);
export const transactionSourceSchema = z.enum([
  "MANUAL",
  "IMPORT",
  "ALLOCATION",
  "BILL_PAYMENT",
]);

export const accountCreateSchema = z.object({
  name: z.string().trim().min(1),
  ownerType: ownerTypeSchema.default("PERSONAL"),
  accountSubtype: accountSubtypeSchema,
  annualRatePercent: z.number().min(0).max(100).nullable().optional(),
  limitAmount: z.number().min(0).nullable().optional(),
  startingBalance: z.number().default(0),
  startingDate: z.string().datetime().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const accountPatchSchema = accountCreateSchema.partial();

export const transactionCreateSchema = z.object({
  date: z.string().datetime(),
  description: z.string().trim().min(1),
  amount: z.number().positive(),
  type: transactionTypeSchema,
  source: transactionSourceSchema.default("MANUAL"),
  fromAccountId: z.number().int().positive().nullable().optional(),
  toAccountId: z.number().int().positive().nullable().optional(),
  billId: z.number().int().positive().nullable().optional(),
  category: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
});

export const transactionPatchSchema = transactionCreateSchema.partial();

export const billCreateSchema = z.object({
  name: z.string().trim().min(1),
  defaultAmount: z.number().min(0).default(0),
  dueDay: z.number().int().min(1).max(31),
  dueGroup: z.string().trim().min(1).nullable().optional(),
  category: z.string().trim().min(1).nullable().optional(),
  active: z.boolean().default(true),
  defaultFromAccountId: z.number().int().positive().nullable().optional(),
  defaultToAccountId: z.number().int().positive().nullable().optional(),
});

export const billPatchSchema = billCreateSchema.partial();

export const portfolioCreateSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
});

export const holdingCreateSchema = z.object({
  portfolioId: z.number().int().positive(),
  symbol: z.string().trim().min(1),
  name: z.string().trim().nullable().optional(),
  shares: z.number().min(0).default(0),
  averageCost: z.number().min(0).default(0),
  currentPrice: z.number().min(0).nullable().optional(),
  categoryName: z.string().trim().nullable().optional(),
});

export const tradeCreateSchema = z.object({
  portfolioId: z.number().int().positive(),
  symbol: z.string().trim().min(1),
  tradeType: z.enum(["BUY", "SELL"]),
  shares: z.number().positive(),
  price: z.number().min(0),
  fee: z.number().min(0).default(0),
  tradeDate: z.string().datetime(),
  notes: z.string().trim().nullable().optional(),
});

export const dividendCreateSchema = z.object({
  portfolioId: z.number().int().positive(),
  symbol: z.string().trim().min(1),
  amount: z.number().min(0),
  payDate: z.string().datetime(),
  notes: z.string().trim().nullable().optional(),
});

export const snapshotCreateSchema = z.object({
  portfolioId: z.number().int().positive(),
  snapshotDate: z.string().datetime(),
  totalValue: z.number(),
  investedAmount: z.number(),
  unrealizedPnL: z.number(),
  estimatedDayMove: z.number(),
});

export const fireSettingsSchema = z.object({
  currentAge: z.number().int().min(0).max(120),
  projectedAnnualIncome: z.number().min(0),
  annualSpending: z.number().min(0),
  expectedReturnPct: z.number().min(0).max(100),
  inflationPct: z.number().min(0).max(100),
  swrPct: z.number().min(0).max(100),
  contributionOverride: z.number().min(0).nullable().optional(),
});

export const strategyItemCreateSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  status: z.string().trim().default("planned"),
  targetDate: z.string().datetime().nullable().optional(),
});
