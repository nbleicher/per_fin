export type OwnerType = "PERSONAL" | "BUSINESS";
export type AccountSubtype = "CHECKING" | "SAVINGS" | "CREDIT" | "LOAN" | "INVESTMENT";
export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";

export type Account = {
  id: number;
  name: string;
  ownerType: OwnerType;
  accountSubtype: AccountSubtype;
  annualRatePercent: number | null;
  limitAmount: number | null;
  startingBalance: number;
  startingDate: string | null;
  isActive: boolean;
};

export type Transaction = {
  id: number;
  date: string;
  yearMonth: string;
  description: string;
  amount: number;
  type: TransactionType;
  source: "MANUAL" | "IMPORT" | "ALLOCATION" | "BILL_PAYMENT";
  fromAccountId: number | null;
  toAccountId: number | null;
  billId: number | null;
  category: string | null;
  notes: string | null;
};

export type Bill = {
  id: number;
  name: string;
  defaultAmount: number;
  dueDay: number;
  dueGroup: string | null;
  category: string | null;
  active: boolean;
  defaultFromAccountId: number | null;
  defaultToAccountId: number | null;
};
