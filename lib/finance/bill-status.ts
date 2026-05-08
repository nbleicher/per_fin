import type { Bill, Transaction } from "@/lib/types/domain";

/** Bill ids that have any ledger row for this calendar month (matches Finance bill paid logic). */
export function paidBillIdsForMonth(transactions: Transaction[], yearMonth: string): Set<number> {
  const set = new Set<number>();
  for (const t of transactions) {
    if (t.billId != null && t.yearMonth === yearMonth) {
      set.add(t.billId);
    }
  }
  return set;
}

export function filterBillsUnpaidForMonth(
  bills: Bill[],
  transactions: Transaction[],
  yearMonth: string,
): Bill[] {
  const paid = paidBillIdsForMonth(transactions, yearMonth);
  return bills.filter((b) => b.active && !paid.has(b.id));
}

/** Latest ledger row for this bill/month (for undo; matches Finance using one txn per bill/month). */
export function findPaymentTransactionForBillMonth(
  transactions: Transaction[],
  billId: number,
  yearMonth: string,
): Transaction | undefined {
  let best: Transaction | undefined;
  for (const t of transactions) {
    if (t.billId !== billId || t.yearMonth !== yearMonth) continue;
    if (!best || t.date > best.date || (t.date === best.date && t.id > best.id)) {
      best = t;
    }
  }
  return best;
}

/** Payload for POST /api/transactions — shared with Finance “Mark paid”. */
export function buildBillPaymentPayload(bill: Bill, paidDate: Date = new Date()) {
  return {
    date: paidDate.toISOString(),
    description: `${bill.name} payment`,
    amount: bill.defaultAmount,
    type: bill.defaultToAccountId ? ("TRANSFER" as const) : ("EXPENSE" as const),
    source: "BILL_PAYMENT" as const,
    fromAccountId: bill.defaultFromAccountId,
    toAccountId: bill.defaultToAccountId,
    billId: bill.id,
    category: bill.category,
  };
}

/** Active bills with a payment this month (for “Paid this month” + Undo). */
export function filterBillsPaidForMonth(
  bills: Bill[],
  transactions: Transaction[],
  yearMonth: string,
): Bill[] {
  const paid = paidBillIdsForMonth(transactions, yearMonth);
  return bills.filter((b) => b.active && paid.has(b.id));
}

/** Upcoming-style sort: sooner due days first (same heuristic as dashboard). */
export function upcomingUnpaidBillsForMonth(
  bills: Bill[],
  transactions: Transaction[],
  yearMonth: string,
  max = 8,
  referenceDate: Date = new Date(),
): Bill[] {
  const unpaid = filterBillsUnpaidForMonth(bills, transactions, yearMonth);
  const today = referenceDate.getDate();
  return [...unpaid]
    .sort((a, b) => {
      const da = a.dueDay >= today ? a.dueDay : a.dueDay + 31;
      const db = b.dueDay >= today ? b.dueDay : b.dueDay + 31;
      return da - db;
    })
    .slice(0, max);
}
