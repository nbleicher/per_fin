import type { Account } from "@/lib/types/domain";

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

/** Payload for POST /api/transactions so computed owed balance moves toward `targetOwed`. */
export function buildLiabilityBalanceAdjustmentPayload(
  account: Pick<Account, "id" | "name" | "accountSubtype">,
  computedOwed: number,
  targetOwed: number,
): {
  date: string;
  description: string;
  amount: number;
  type: "EXPENSE";
  source: "MANUAL";
  fromAccountId: number | null;
  toAccountId: number | null;
} | null {
  if (account.accountSubtype !== "CREDIT" && account.accountSubtype !== "LOAN") {
    return null;
  }
  const delta = roundMoney(targetOwed - computedOwed);
  if (Math.abs(delta) < 0.005) {
    return null;
  }
  const date = new Date().toISOString();
  const label = account.name.trim().slice(0, 80) || `Account ${account.id}`;
  if (delta > 0) {
    return {
      date,
      description: `Balance reconciliation — ${label}`,
      amount: delta,
      type: "EXPENSE",
      source: "MANUAL",
      fromAccountId: account.id,
      toAccountId: null,
    };
  }
  return {
    date,
    description: `Balance reconciliation — ${label}`,
    amount: roundMoney(-delta),
    type: "EXPENSE",
    source: "MANUAL",
    fromAccountId: null,
    toAccountId: account.id,
  };
}
