"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { fetchDashboardBundle } from "@/features/dashboard/fetch-dashboard-bundle";
import { computeAccountBalances, isAssetSubtype } from "@/lib/finance/balances";
import { billDueBadgeLabel } from "@/lib/finance/bill-due-badge";
import {
  buildBillPaymentPayload,
  filterBillsPaidForMonth,
  filterBillsUnpaidForMonth,
  findPaymentTransactionForBillMonth,
  upcomingUnpaidBillsForMonth,
} from "@/lib/finance/bill-status";
import { queryKeys } from "@/lib/query-keys";
import type { Account, AccountSubtype, Bill, Transaction } from "@/lib/types/domain";
import type { DashboardInitialData, DashboardSummary } from "@/lib/types/dashboard";
import styles from "./dashboard-page.module.css";

type ApiSuccess<T> = { ok: true; data: T; meta?: Record<string, unknown> };
type ApiError = { ok: false; error: { code: string; message: string } };

const SUBTYPE_COLORS: Record<AccountSubtype, string> = {
  CHECKING: "#7c3aed",
  SAVINGS: "#0891b2",
  CREDIT: "#dc2626",
  LOAN: "#b45309",
  INVESTMENT: "#16a34a",
};

function BillCategoryGlyph({ category }: { category: string | null }) {
  const c = (category ?? "").toLowerCase();
  const svg = (path: ReactNode) => (
    <svg
      className={styles.billIcon}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {path}
    </svg>
  );
  if (/rent|housing|mortgage|home/.test(c)) {
    return svg(<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />);
  }
  if (/internet|wifi|web|fiber/.test(c)) {
    return svg(
      <>
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <path d="M12 20h.01" />
      </>,
    );
  }
  if (/electric|utility|water|gas|power/.test(c)) {
    return svg(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />);
  }
  return svg(<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />);
}

function cashflowSeries(txns: Transaction[], months = 6) {
  const byMonth = new Map<string, { income: number; expense: number }>();
  for (const t of txns) {
    if (!byMonth.has(t.yearMonth)) {
      byMonth.set(t.yearMonth, { income: 0, expense: 0 });
    }
    const row = byMonth.get(t.yearMonth)!;
    if (t.type === "INCOME") row.income += t.amount;
    if (t.type === "EXPENSE") row.expense += t.amount;
  }
  const keys = [...byMonth.keys()].sort();
  const slice = keys.slice(-months);
  return slice.map((yearMonth) => ({
    yearMonth,
    income: byMonth.get(yearMonth)!.income,
    expense: byMonth.get(yearMonth)!.expense,
  }));
}

function assetSubtypeTotals(accounts: Account[], balances: Map<number, number>) {
  const totals: Partial<Record<AccountSubtype, number>> = {};
  for (const a of accounts) {
    if (!isAssetSubtype(a.accountSubtype)) continue;
    const b = balances.get(a.id) ?? 0;
    totals[a.accountSubtype] = (totals[a.accountSubtype] ?? 0) + b;
  }
  return totals;
}

function debtBreakdown(accounts: Account[], balances: Map<number, number>) {
  let credit = 0;
  let loan = 0;
  for (const a of accounts) {
    const b = balances.get(a.id) ?? 0;
    if (a.accountSubtype === "CREDIT") credit += Math.abs(b);
    if (a.accountSubtype === "LOAN") loan += Math.abs(b);
  }
  return { credit, loan, total: credit + loan };
}

function topBalances(accounts: Account[], balances: Map<number, number>, n = 6) {
  return [...accounts]
    .map((a) => ({
      id: a.id,
      name: a.name,
      subtype: a.accountSubtype,
      balance: balances.get(a.id) ?? 0,
    }))
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
    .slice(0, n);
}

export function DashboardPage({ initialData }: { initialData?: DashboardInitialData }) {
  const queryClient = useQueryClient();
  const { data, isFetching, error: queryError } = useQuery({
    queryKey: queryKeys.dashboard.bundle,
    queryFn: fetchDashboardBundle,
    initialData: initialData,
  });

  const refreshBundle = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.bundle });
  }, [queryClient]);

  const summary: DashboardSummary | null = data?.summary ?? null;
  const accounts = useMemo(() => data?.accounts ?? [], [data]);
  const transactions = useMemo(() => data?.transactions ?? [], [data]);
  const bills = useMemo(() => data?.bills ?? [], [data]);
  const budgetBatches = useMemo(() => data?.budgetBatches ?? [], [data]);
  const snapshotSeries = useMemo(() => data?.snapshotSeries ?? [], [data]);

  const [billActionError, setBillActionError] = useState<string | null>(null);
  const [billWorkingId, setBillWorkingId] = useState<number | null>(null);

  const loading = isFetching;
  const error =
    queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;

  const balances = useMemo(
    () => computeAccountBalances(accounts, transactions),
    [accounts, transactions],
  );

  const debt = useMemo(() => debtBreakdown(accounts, balances), [accounts, balances]);
  const cashflow = useMemo(() => cashflowSeries(transactions, 6), [transactions]);
  const assetTotals = useMemo(() => assetSubtypeTotals(accounts, balances), [accounts, balances]);

  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const refDate = useMemo(() => new Date(), []);
  const paidThisMonth = useMemo(
    () => filterBillsPaidForMonth(bills, transactions, currentMonth),
    [bills, transactions, currentMonth],
  );
  const activeBillCount = useMemo(() => bills.filter((b) => b.active).length, [bills]);
  const monthLabel = useMemo(
    () =>
      new Date(`${currentMonth}-01T12:00:00`).toLocaleString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [currentMonth],
  );
  const unpaidAll = useMemo(
    () => filterBillsUnpaidForMonth(bills, transactions, currentMonth),
    [bills, transactions, currentMonth],
  );
  const billsPreview = useMemo(
    () => upcomingUnpaidBillsForMonth(bills, transactions, currentMonth, 8, refDate),
    [bills, transactions, currentMonth, refDate],
  );
  const unpaidSummaryLine = useMemo(() => {
    if (activeBillCount === 0) return undefined;
    const total = unpaidAll.reduce((s, b) => s + b.defaultAmount, 0);
    return `${monthLabel} • ${unpaidAll.length} unpaid • $${total.toFixed(2)} due`;
  }, [activeBillCount, unpaidAll, monthLabel]);

  const topAcct = useMemo(() => topBalances(accounts, balances), [accounts, balances]);

  const markBillPaid = useCallback(
    async (bill: Bill) => {
      setBillActionError(null);
      setBillWorkingId(bill.id);
      try {
        const res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildBillPaymentPayload(bill)),
        });
        const body = (await res.json().catch(() => null)) as ApiSuccess<unknown> | ApiError | null;
        if (!res.ok || !body?.ok) {
          setBillActionError(!body || body.ok ? "Failed to mark bill as paid." : body.error.message);
          return;
        }
        await refreshBundle();
      } catch {
        setBillActionError("Failed to mark bill as paid.");
      } finally {
        setBillWorkingId(null);
      }
    },
    [refreshBundle],
  );

  const undoBillPaid = useCallback(
    async (billId: number) => {
      setBillActionError(null);
      const txn = findPaymentTransactionForBillMonth(transactions, billId, currentMonth);
      if (!txn) return;
      setBillWorkingId(billId);
      try {
        const res = await fetch(`/api/transactions/${txn.id}`, { method: "DELETE" });
        if (!res.ok) {
          setBillActionError("Failed to undo bill payment.");
          return;
        }
        await refreshBundle();
      } catch {
        setBillActionError("Failed to undo bill payment.");
      } finally {
        setBillWorkingId(null);
      }
    },
    [refreshBundle, transactions, currentMonth],
  );

  const assetSumForMix = useMemo(() => {
    let s = 0;
    for (const v of Object.values(assetTotals)) {
      if (v != null && v > 0) s += v;
    }
    return s;
  }, [assetTotals]);

  const latestBudget = budgetBatches[0];
  const allocatedPct = latestBudget
    ? latestBudget.items.reduce((sum, i) => sum + i.percent, 0)
    : 0;

  const sparkPoints = useMemo(() => {
    const pts = snapshotSeries.slice(-8);
    if (pts.length === 0) return null;
    const vals = pts.map((p) => p.totalValue);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const w = 280;
    const h = 72;
    const pad = 4;
    const pointsAttr = pts
      .map((p, i) => {
        const x = pad + (i / Math.max(pts.length - 1, 1)) * (w - pad * 2);
        const y = pad + (1 - (p.totalValue - min) / range) * (h - pad * 2);
        return `${x},${y}`;
      })
      .join(" ");
    return { pts, pointsAttr, w, h };
  }, [snapshotSeries]);

  const maxCashflowBar = useMemo(() => {
    let m = 1;
    for (const row of cashflow) {
      m = Math.max(m, row.income, row.expense);
    }
    return m;
  }, [cashflow]);

  return (
    <div className={styles.dashboard}>
      <Card title="Overview" description="Net worth, cash flow, debt, and ledger activity.">
        {loading ? <p>Loading dashboard...</p> : null}
        {error ? <p className={styles.errorText}>{error}</p> : null}
        {summary ? (
          <>
            <p className={styles.sectionTitle}>Key metrics</p>
            <div className={styles.kpiGrid}>
              <Metric label="Net worth" value={summary.netWorth} emphasis />
              <Metric label="Assets" value={summary.assets} />
              <Metric label="Liabilities" value={summary.liabilities} />
              <Metric label="Debt (credit + loan)" value={debt.total} hint="Abs. balances on credit & loan" />
              <Metric label="Income (month)" value={summary.monthIncome} />
              <Metric label="Expenses (month)" value={summary.monthExpenses} />
              <Metric label="Transfers (month)" value={summary.monthTransfers} />
              <Metric label="Accounts" value={summary.accountCount} numeric={false} />
              <Metric label="Transactions" value={summary.transactionCount} numeric={false} />
            </div>
          </>
        ) : null}
      </Card>

      {!loading && summary ? (
        <>
          <Card title="Trends & allocation" description="Cash flow by month, asset mix, portfolio snapshots.">
            <div className={styles.visualRow}>
              <div className={styles.chartCard}>
                <div className={styles.chartTitle}>Cash flow by month</div>
                {cashflow.length === 0 ? (
                  <p className={styles.muted}>No transactions yet.</p>
                ) : (
                  <div className={styles.barRow}>
                    {cashflow.map((row) => (
                      <div key={row.yearMonth} className={styles.barPair}>
                        <div
                          className={styles.barIncome}
                          style={{
                            height: `${Math.max(4, (row.income / maxCashflowBar) * 90)}px`,
                          }}
                          title={`Income ${row.income.toFixed(2)}`}
                        />
                        <div
                          className={styles.barExpense}
                          style={{
                            height: `${Math.max(4, (row.expense / maxCashflowBar) * 90)}px`,
                          }}
                          title={`Expenses ${row.expense.toFixed(2)}`}
                        />
                        <span className={styles.monthLabel}>{row.yearMonth.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className={styles.legend}>
                  <span>
                    <span className={styles.legendSwatch} style={{ background: "rgba(22,163,74,0.65)" }} />
                    Income
                  </span>
                  <span>
                    <span className={styles.legendSwatch} style={{ background: "rgba(220,38,38,0.55)" }} />
                    Expenses
                  </span>
                </div>
              </div>

              <div className={styles.chartCard}>
                <div className={styles.chartTitle}>Asset mix by subtype</div>
                {assetSumForMix <= 0 ? (
                  <p className={styles.muted}>No positive asset balances to chart.</p>
                ) : (
                  <>
                    <div className={styles.segments}>
                      {(Object.keys(assetTotals) as AccountSubtype[]).map((subtype) => {
                        const v = assetTotals[subtype] ?? 0;
                        if (v <= 0) return null;
                        const pct = (v / assetSumForMix) * 100;
                        return (
                          <div
                            key={subtype}
                            className={styles.segment}
                            style={{
                              width: `${pct}%`,
                              background: SUBTYPE_COLORS[subtype],
                            }}
                            title={`${subtype}: $${v.toFixed(2)}`}
                          />
                        );
                      })}
                    </div>
                    <div className={styles.legend}>
                      {(Object.keys(assetTotals) as AccountSubtype[]).map((subtype) => {
                        const v = assetTotals[subtype] ?? 0;
                        if (v <= 0) return null;
                        return (
                          <span key={subtype}>
                            <span
                              className={styles.legendSwatch}
                              style={{ background: SUBTYPE_COLORS[subtype] }}
                            />
                            {subtype}: ${v.toFixed(0)}
                          </span>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className={styles.chartCard}>
                <div className={styles.chartTitle}>Portfolio value (snapshots)</div>
                {!sparkPoints ? (
                  <p className={styles.muted}>No portfolio snapshots yet.</p>
                ) : (
                  <svg
                    className={styles.chartSvg}
                    viewBox={`0 0 ${sparkPoints.w} ${sparkPoints.h}`}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <polyline
                      fill="none"
                      stroke="var(--brand)"
                      strokeWidth="2"
                      points={sparkPoints.pointsAttr}
                    />
                  </svg>
                )}
                {sparkPoints && sparkPoints.pts.length > 0 ? (
                  <p className={styles.muted}>
                    Last point: ${sparkPoints.pts[sparkPoints.pts.length - 1].totalValue.toFixed(2)} on{" "}
                    {sparkPoints.pts[sparkPoints.pts.length - 1].date}
                  </p>
                ) : null}
              </div>
            </div>
          </Card>

          <Card title="Bills, budget & balances" description="Operational snapshot from bills and ledger-derived balances.">
            <div className={styles.opsRow}>
              <div>
                <SectionHeader title="Upcoming bills" summary={unpaidSummaryLine} />
                {billActionError ? <p className={styles.errorText}>{billActionError}</p> : null}
                {activeBillCount === 0 ? (
                  <p className={styles.muted}>No active bills.</p>
                ) : billsPreview.length === 0 && paidThisMonth.length > 0 ? (
                  <p className={styles.muted}>All bills are marked paid for {monthLabel}.</p>
                ) : billsPreview.length === 0 ? (
                  <p className={styles.muted}>No upcoming bills.</p>
                ) : (
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Due</th>
                        <th className="numeric">Amount</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {billsPreview.map((b) => {
                        const dueLabel = billDueBadgeLabel(b.dueDay, refDate);
                        const dueTone =
                          dueLabel === "Overdue" ? "danger" : dueLabel === "Due today" ? "neutral" : "brand";
                        return (
                          <tr key={b.id}>
                            <td>
                              <div className={styles.billNameCell}>
                                <BillCategoryGlyph category={b.category} />
                                <div>
                                  <div className={styles.billTitle}>
                                    {b.name}
                                    {b.category ? ` (${b.category})` : ""}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <Badge tone={dueTone}>{dueLabel}</Badge>
                            </td>
                            <td className="numeric">${b.defaultAmount.toFixed(2)}</td>
                            <td>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={billWorkingId !== null}
                                onClick={() => void markBillPaid(b)}
                              >
                                {billWorkingId === b.id ? "…" : "Mark paid"}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {activeBillCount > 0 ? (
                  <div className={styles.billsFooter}>
                    <Link href="/finance">View all bills</Link>
                  </div>
                ) : null}
                {paidThisMonth.length > 0 ? (
                  <>
                    <SectionHeader title="Paid this month" />
                    <table className="ui-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th className="numeric">Amount</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {paidThisMonth.map((b) => (
                          <tr key={b.id}>
                            <td>{b.name}</td>
                            <td className="numeric">${b.defaultAmount.toFixed(2)}</td>
                            <td>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={billWorkingId !== null}
                                onClick={() => void undoBillPaid(b.id)}
                              >
                                {billWorkingId === b.id ? "…" : "Undo"}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : null}
              </div>

              <div>
                <p className={styles.sectionTitle}>Budget allocation</p>
                {!latestBudget ? (
                  <p className={styles.muted}>No allocation batches yet.</p>
                ) : (
                  <>
                    <p style={{ margin: "0 0 0.35rem", fontSize: 14 }}>
                      Latest weekly pay:{" "}
                      <strong>${latestBudget.weeklyPay.toFixed(2)}</strong>
                    </p>
                    <p className={styles.muted}>
                      Allocated {allocatedPct.toFixed(1)}% across {latestBudget.items.length} account(s).
                      {allocatedPct < 100 ? ` Unallocated: ${(100 - allocatedPct).toFixed(1)}%.` : ""}
                    </p>
                    <p className={styles.muted}>
                      Submitted {new Date(latestBudget.submittedAt).toLocaleString()}
                    </p>
                  </>
                )}
              </div>

              <div>
                <p className={styles.sectionTitle}>Top accounts by balance</p>
                {topAcct.length === 0 ? (
                  <p className={styles.muted}>No accounts.</p>
                ) : (
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Type</th>
                        <th className="numeric">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topAcct.map((row) => (
                        <tr key={row.id}>
                          <td>{row.name}</td>
                          <td>{row.subtype}</td>
                          <td className="numeric">${row.balance.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  numeric = true,
  emphasis,
  hint,
}: {
  label: string;
  value: number;
  numeric?: boolean;
  emphasis?: boolean;
  hint?: string;
}) {
  return (
    <div className={`${styles.metricCard} ${emphasis ? styles.metricEmphasis : ""}`}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={emphasis ? styles.metricValueStrong : styles.metricValue}>
        {numeric ? `$${value.toFixed(2)}` : String(value)}
      </div>
      {hint ? <div className={styles.metricHint}>{hint}</div> : null}
    </div>
  );
}
