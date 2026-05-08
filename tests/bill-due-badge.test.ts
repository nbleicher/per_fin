import test from "node:test";
import assert from "node:assert/strict";
import { billDueBadgeLabel } from "@/lib/finance/bill-due-badge";

test("billDueBadgeLabel returns Due today when due day is today", () => {
  const ref = new Date(2026, 4, 15);
  assert.equal(billDueBadgeLabel(15, ref), "Due today");
});

test("billDueBadgeLabel returns Overdue when due day passed this month", () => {
  const ref = new Date(2026, 4, 20);
  assert.equal(billDueBadgeLabel(10, ref), "Overdue");
});

test("billDueBadgeLabel returns Due in Nd when due is in the future", () => {
  const ref = new Date(2026, 4, 7);
  assert.equal(billDueBadgeLabel(15, ref), "Due in 8d");
});

test("billDueBadgeLabel clamps day to last day of month", () => {
  const ref = new Date(2026, 1, 28);
  assert.equal(billDueBadgeLabel(31, ref), "Due today");
});
