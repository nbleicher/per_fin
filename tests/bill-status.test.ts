import test from "node:test";
import assert from "node:assert/strict";
import type { Bill, Transaction } from "@/lib/types/domain";
import {
  filterBillsPaidForMonth,
  filterBillsUnpaidForMonth,
  findPaymentTransactionForBillMonth,
  paidBillIdsForMonth,
  upcomingUnpaidBillsForMonth,
} from "@/lib/finance/bill-status";

function txn(partial: Partial<Transaction> & Pick<Transaction, "id" | "billId" | "yearMonth">): Transaction {
  return {
    date: "2026-05-01T12:00:00.000Z",
    description: "",
    amount: 10,
    type: "EXPENSE",
    source: "BILL_PAYMENT",
    fromAccountId: 1,
    toAccountId: null,
    category: null,
    notes: null,
    ...partial,
  };
}

const bill = (id: number, active = true): Bill => ({
  id,
  name: `Bill ${id}`,
  defaultAmount: 50,
  dueDay: 15,
  dueGroup: null,
  category: null,
  active,
  defaultFromAccountId: 1,
  defaultToAccountId: null,
});

test("paidBillIdsForMonth is empty when no bill transactions", () => {
  const ids = paidBillIdsForMonth([], "2026-05");
  assert.equal(ids.size, 0);
  const ids2 = paidBillIdsForMonth(
    [txn({ id: 1, billId: null, yearMonth: "2026-05" })],
    "2026-05",
  );
  assert.equal(ids2.size, 0);
});

test("paidBillIdsForMonth collects bill ids for matching month only", () => {
  const transactions: Transaction[] = [
    txn({ id: 1, billId: 10, yearMonth: "2026-05" }),
    txn({ id: 2, billId: 20, yearMonth: "2026-04" }),
    txn({ id: 3, billId: 10, yearMonth: "2026-06" }),
  ];
  const ids = paidBillIdsForMonth(transactions, "2026-05");
  assert.deepEqual([...ids].sort((a, b) => a - b), [10]);
});

test("filterBillsUnpaidForMonth excludes active bills paid this month", () => {
  const bills = [bill(1), bill(2)];
  const transactions: Transaction[] = [txn({ id: 1, billId: 1, yearMonth: "2026-05" })];
  const unpaid = filterBillsUnpaidForMonth(bills, transactions, "2026-05");
  assert.equal(unpaid.length, 1);
  assert.equal(unpaid[0].id, 2);
});

test("filterBillsUnpaidForMonth ignores inactive bills", () => {
  const bills = [bill(1, false)];
  const transactions: Transaction[] = [];
  const unpaid = filterBillsUnpaidForMonth(bills, transactions, "2026-05");
  assert.equal(unpaid.length, 0);
});

test("findPaymentTransactionForBillMonth picks latest by date then id", () => {
  const transactions: Transaction[] = [
    txn({ id: 1, billId: 5, yearMonth: "2026-05", date: "2026-05-02T12:00:00.000Z" }),
    txn({ id: 2, billId: 5, yearMonth: "2026-05", date: "2026-05-10T12:00:00.000Z" }),
    txn({ id: 3, billId: 5, yearMonth: "2026-05", date: "2026-05-10T12:00:00.000Z" }),
  ];
  const found = findPaymentTransactionForBillMonth(transactions, 5, "2026-05");
  assert.equal(found?.id, 3);
});

test("filterBillsPaidForMonth lists active bills with a payment in month", () => {
  const bills = [bill(1), bill(2)];
  const transactions: Transaction[] = [txn({ id: 1, billId: 1, yearMonth: "2026-05" })];
  const paid = filterBillsPaidForMonth(bills, transactions, "2026-05");
  assert.equal(paid.length, 1);
  assert.equal(paid[0].id, 1);
});

test("upcomingUnpaidBillsForMonth sorts by due heuristic and caps", () => {
  const bills = [bill(1), bill(2), bill(3)];
  bills[0].dueDay = 5;
  bills[1].dueDay = 25;
  bills[2].dueDay = 28;
  const transactions: Transaction[] = [txn({ id: 1, billId: 2, yearMonth: "2026-05" })];
  const ref = new Date(2026, 4, 7);
  const upcoming = upcomingUnpaidBillsForMonth(bills, transactions, "2026-05", 2, ref);
  assert.equal(upcoming.length, 2);
  assert.ok(upcoming.every((b) => b.id !== 2));
  assert.deepEqual(
    upcoming.map((b) => b.id),
    [3, 1],
  );
});
