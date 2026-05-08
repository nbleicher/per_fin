"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { Tabs, type TabOption } from "@/components/ui/tabs";
import { fetchFinanceWorkspace } from "@/features/finance/fetch-finance-workspace";
import type { Account, Bill, Transaction } from "@/lib/types/domain";
import { billDueBadgeLabel } from "@/lib/finance/bill-due-badge";
import { buildBillPaymentPayload } from "@/lib/finance/bill-status";
import { computeAccountBalances } from "@/lib/finance/balances";
import { buildLiabilityBalanceAdjustmentPayload } from "@/lib/finance/liability-balance-adjustment";
import { formatAccountOptionLabel } from "@/lib/account-option-label";
import { queryKeys } from "@/lib/query-keys";
import { InvestmentsTab } from "@/features/finance/investments-tab";
import { FireTab } from "@/features/finance/fire-tab";

const financeTabs: TabOption[] = [
  { id: "bills", label: "Bills" },
  { id: "budget", label: "Budget" },
  { id: "credit", label: "Credit" },
  { id: "debit", label: "Debit" },
  { id: "investments", label: "Investments" },
  { id: "fire", label: "FIRE" },
];

type ApiSuccess<T> = { ok: true; data: T };
type ApiError = { ok: false; error: { code: string; message: string } };

type AddModalKind = "bill" | "credit" | "debit" | null;

export function FinanceWorkspaceShell() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("bills");
  const { data, isFetching, error: queryError } = useQuery({
    queryKey: queryKeys.finance.workspace,
    queryFn: fetchFinanceWorkspace,
  });

  const accounts = useMemo(() => data?.accounts ?? [], [data]);
  const bills = useMemo(() => data?.bills ?? [], [data]);
  const transactions = useMemo(() => data?.transactions ?? [], [data]);

  const error =
    queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;

  const loading = isFetching;
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const [weeklyPay, setWeeklyPay] = useState("");
  const [allocationRows, setAllocationRows] = useState<Array<{ accountId: string; percent: string }>>([
    { accountId: "", percent: "" },
  ]);
  const [budgetResult, setBudgetResult] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [addModal, setAddModal] = useState<AddModalKind>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const [billName, setBillName] = useState("");
  const [billDefaultAmount, setBillDefaultAmount] = useState("");
  const [billDueDay, setBillDueDay] = useState("");
  const [billActive, setBillActive] = useState(true);
  const [billDueGroup, setBillDueGroup] = useState("");
  const [billCategory, setBillCategory] = useState("");
  const [billFromAccountId, setBillFromAccountId] = useState("");
  const [billToAccountId, setBillToAccountId] = useState("");

  const [accName, setAccName] = useState("");
  const [accOwnerType, setAccOwnerType] = useState<"PERSONAL" | "BUSINESS">("PERSONAL");
  const [accStartingBalance, setAccStartingBalance] = useState("");
  const [accIsActive, setAccIsActive] = useState(true);
  const [accApr, setAccApr] = useState("");
  const [accLimit, setAccLimit] = useState("");
  const [accStartingDate, setAccStartingDate] = useState("");

  const [creditExpandedId, setCreditExpandedId] = useState<number | null>(null);
  const [creditTargetBalance, setCreditTargetBalance] = useState("");
  const [creditBalanceSubmitting, setCreditBalanceSubmitting] = useState(false);
  const [debitExpandedId, setDebitExpandedId] = useState<number | null>(null);
  const [debitTargetBalance, setDebitTargetBalance] = useState("");
  const [debitBalanceSubmitting, setDebitBalanceSubmitting] = useState(false);

  const invalidateFinanceAndDashboard = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.workspace }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.bundle }),
    ]);
  }, [queryClient]);

  const balances = useMemo(() => computeAccountBalances(accounts, transactions), [accounts, transactions]);

  const billStatus = useMemo(() => {
    const map = new Map<number, Transaction>();
    for (const txn of transactions) {
      if (txn.billId && txn.yearMonth === selectedMonth) {
        map.set(txn.billId, txn);
      }
    }
    return map;
  }, [selectedMonth, transactions]);

  const addAllocationRow = () => {
    setAllocationRows((prev) => [...prev, { accountId: "", percent: "" }]);
  };

  const updateAllocationRow = (idx: number, patch: Partial<{ accountId: string; percent: string }>) => {
    setAllocationRows((prev) => prev.map((row, rowIdx) => (rowIdx === idx ? { ...row, ...patch } : row)));
  };

  const removeAllocationRow = (idx: number) => {
    setAllocationRows((prev) => prev.filter((_, rowIdx) => rowIdx !== idx));
  };

  const submitBudgetAllocation = async () => {
    setActionError(null);
    setBudgetResult(null);
    const weeklyPayNum = Number(weeklyPay);
    if (!Number.isFinite(weeklyPayNum) || weeklyPayNum <= 0) {
      setActionError("Weekly pay must be a positive number.");
      return;
    }
    const allocations = allocationRows
      .map((row) => ({
        accountId: Number(row.accountId),
        percent: Number(row.percent),
      }))
      .filter((row) => Number.isFinite(row.accountId) && Number.isFinite(row.percent));
    if (allocations.length === 0) {
      setActionError("Add at least one valid allocation row.");
      return;
    }
    const totalPercent = allocations.reduce((sum, row) => sum + row.percent, 0);
    if (totalPercent > 100) {
      setActionError("Allocation percent total cannot exceed 100.");
      return;
    }
    const res = await fetch("/api/budget-allocations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weeklyPay: weeklyPayNum,
        allocations,
      }),
    });
    const body = (await res.json().catch(() => null)) as
      | ApiSuccess<{ createdTransactions: Transaction[]; totals: { allocatedAmount: number; percent: number } }>
      | ApiError
      | null;
    if (!res.ok || !body?.ok) {
      setActionError(body && !body.ok ? body.error.message : "Failed to submit allocation.");
      return;
    }
    setBudgetResult(
      `Created ${body.data.createdTransactions.length} allocation transaction(s), totaling $${body.data.totals.allocatedAmount.toFixed(2)}.`,
    );
    await invalidateFinanceAndDashboard();
  };

  const markBillPaid = async (bill: Bill) => {
    setActionError(null);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBillPaymentPayload(bill)),
    });
    if (!res.ok) {
      setActionError("Failed to mark bill as paid.");
      return;
    }
    await invalidateFinanceAndDashboard();
  };

  const closeAddModal = useCallback(() => {
    setAddModal(null);
    setModalError(null);
    setModalSubmitting(false);
  }, []);

  useEffect(() => {
    if (!addModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAddModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [addModal, closeAddModal]);

  useEffect(() => {
    if (activeTab !== "credit") {
      setCreditExpandedId(null);
    }
    if (activeTab !== "debit") {
      setDebitExpandedId(null);
    }
  }, [activeTab]);

  const openBillModal = () => {
    const d = new Date();
    setBillName("");
    setBillDefaultAmount("0");
    setBillDueDay(String(Math.min(Math.max(d.getDate(), 1), 31)));
    setBillActive(true);
    setBillDueGroup("");
    setBillCategory("");
    setBillFromAccountId("");
    setBillToAccountId("");
    setModalError(null);
    setAddModal("bill");
  };

  const resetAccountForm = () => {
    setAccName("");
    setAccOwnerType("PERSONAL");
    setAccStartingBalance("0");
    setAccIsActive(true);
    setAccApr("");
    setAccLimit("");
    setAccStartingDate("");
    setModalError(null);
  };

  const openCreditModal = () => {
    resetAccountForm();
    setAddModal("credit");
  };

  const openDebitModal = () => {
    resetAccountForm();
    setAddModal("debit");
  };

  const submitBillModal = async () => {
    setModalError(null);
    setActionError(null);
    const name = billName.trim();
    if (!name) {
      setModalError("Name is required.");
      return;
    }
    const defaultAmount = Number(billDefaultAmount);
    if (!Number.isFinite(defaultAmount) || defaultAmount < 0) {
      setModalError("Default amount must be a number ≥ 0.");
      return;
    }
    const dueDay = Number.parseInt(billDueDay, 10);
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      setModalError("Due day must be between 1 and 31.");
      return;
    }
    const fromParsed = billFromAccountId ? Number(billFromAccountId) : NaN;
    const toParsed = billToAccountId ? Number(billToAccountId) : NaN;
    const payload = {
      name,
      defaultAmount,
      dueDay,
      active: billActive,
      dueGroup: billDueGroup.trim() ? billDueGroup.trim() : null,
      category: billCategory.trim() ? billCategory.trim() : null,
      defaultFromAccountId:
        Number.isInteger(fromParsed) && fromParsed > 0 ? fromParsed : null,
      defaultToAccountId: Number.isInteger(toParsed) && toParsed > 0 ? toParsed : null,
    };

    setModalSubmitting(true);
    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as ApiSuccess<Bill> | ApiError | null;
      if (!res.ok || !body?.ok) {
        const msg = body && !body.ok ? body.error.message : "Failed to add bill.";
        setModalError(msg);
        setActionError(msg);
        return;
      }
      closeAddModal();
      setActionError(null);
      await invalidateFinanceAndDashboard();
    } finally {
      setModalSubmitting(false);
    }
  };

  const submitAccountModal = async (accountSubtype: "CREDIT" | "LOAN") => {
    setModalError(null);
    setActionError(null);
    const name = accName.trim();
    if (!name) {
      setModalError("Name is required.");
      return;
    }
    const startingBalance = Number(accStartingBalance);
    if (!Number.isFinite(startingBalance)) {
      setModalError("Starting balance must be a number.");
      return;
    }

    const payload: Record<string, unknown> = {
      name,
      ownerType: accOwnerType,
      accountSubtype,
      startingBalance,
      isActive: accIsActive,
    };

    if (accApr.trim() !== "") {
      const apr = Number(accApr);
      if (!Number.isFinite(apr) || apr < 0 || apr > 100) {
        setModalError("APR must be between 0 and 100.");
        return;
      }
      payload.annualRatePercent = apr;
    } else {
      payload.annualRatePercent = null;
    }

    if (accLimit.trim() !== "") {
      const limit = Number(accLimit);
      if (!Number.isFinite(limit) || limit < 0) {
        setModalError("Credit limit must be a number ≥ 0.");
        return;
      }
      payload.limitAmount = limit;
    } else {
      payload.limitAmount = null;
    }

    if (accStartingDate.trim() !== "") {
      payload.startingDate = `${accStartingDate.trim()}T12:00:00.000Z`;
    }

    setModalSubmitting(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as ApiSuccess<unknown> | ApiError | null;
      if (!res.ok || !body?.ok) {
        const msg =
          body && !body.ok ? body.error.message : `Failed to add ${accountSubtype === "CREDIT" ? "credit" : "loan"} account.`;
        setModalError(msg);
        setActionError(msg);
        return;
      }
      closeAddModal();
      setActionError(null);
      await invalidateFinanceAndDashboard();
    } finally {
      setModalSubmitting(false);
    }
  };

  const undoBillPaid = async (billId: number) => {
    setActionError(null);
    const txn = billStatus.get(billId);
    if (!txn) return;
    const res = await fetch(`/api/transactions/${txn.id}`, { method: "DELETE" });
    if (!res.ok) {
      setActionError("Failed to undo bill payment.");
      return;
    }
    await invalidateFinanceAndDashboard();
  };

  const creditAccounts = accounts.filter((account) => account.accountSubtype === "CREDIT");
  const debitAccounts = accounts.filter((account) => account.accountSubtype === "LOAN");

  const toggleCreditExpand = (account: Account) => {
    if (creditExpandedId === account.id) {
      setCreditExpandedId(null);
      return;
    }
    setCreditExpandedId(account.id);
    setCreditTargetBalance((balances.get(account.id) ?? 0).toFixed(2));
  };

  const submitCreditBalanceReconciliation = useCallback(async () => {
    if (creditExpandedId == null) return;
    const account = creditAccounts.find((a) => a.id === creditExpandedId);
    if (!account) return;
    setActionError(null);
    const target = Number(creditTargetBalance);
    if (!Number.isFinite(target)) {
      setActionError("Enter a valid balance amount.");
      return;
    }
    const computed = balances.get(account.id) ?? 0;
    const payload = buildLiabilityBalanceAdjustmentPayload(account, computed, target);
    if (!payload) {
      return;
    }
    setCreditBalanceSubmitting(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as ApiSuccess<unknown> | ApiError | null;
      if (!res.ok || !body?.ok) {
        setActionError(body && !body.ok ? body.error.message : "Failed to record balance adjustment.");
        return;
      }
      setActionError(null);
      setCreditExpandedId(null);
      await invalidateFinanceAndDashboard();
    } finally {
      setCreditBalanceSubmitting(false);
    }
  }, [creditExpandedId, creditTargetBalance, creditAccounts, balances, invalidateFinanceAndDashboard]);

  const toggleDebitExpand = (account: Account) => {
    if (debitExpandedId === account.id) {
      setDebitExpandedId(null);
      return;
    }
    setDebitExpandedId(account.id);
    setDebitTargetBalance((balances.get(account.id) ?? 0).toFixed(2));
  };

  const submitDebitBalanceReconciliation = useCallback(async () => {
    if (debitExpandedId == null) return;
    const account = debitAccounts.find((a) => a.id === debitExpandedId);
    if (!account) return;
    setActionError(null);
    const target = Number(debitTargetBalance);
    if (!Number.isFinite(target)) {
      setActionError("Enter a valid balance amount.");
      return;
    }
    const computed = balances.get(account.id) ?? 0;
    const payload = buildLiabilityBalanceAdjustmentPayload(account, computed, target);
    if (!payload) {
      return;
    }
    setDebitBalanceSubmitting(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as ApiSuccess<unknown> | ApiError | null;
      if (!res.ok || !body?.ok) {
        setActionError(body && !body.ok ? body.error.message : "Failed to record balance adjustment.");
        return;
      }
      setActionError(null);
      setDebitExpandedId(null);
      await invalidateFinanceAndDashboard();
    } finally {
      setDebitBalanceSubmitting(false);
    }
  }, [debitExpandedId, debitTargetBalance, debitAccounts, balances, invalidateFinanceAndDashboard]);

  const selectedIsCurrentMonth = selectedMonth === new Date().toISOString().slice(0, 7);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Card
        title="Finance Workspace"
        description="Single operational page with tabbed sections for daily workflows."
      >
        <Tabs options={financeTabs} activeId={activeTab} onChange={setActiveTab} />
        {loading ? <p>Loading finance data...</p> : null}
        {error || actionError ? (
          <p style={{ color: "var(--destructive)", fontSize: "0.875rem" }}>
            {[error, actionError].filter(Boolean).join(" ")}
          </p>
        ) : null}

        {activeTab === "bills" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "0.9rem" }}>Bills</strong>
              <Button variant="outline" size="sm" type="button" onClick={openBillModal}>
                Add Bill
              </Button>
            </div>
            <label className="ui-label" style={{ maxWidth: 280 }}>
              Month
              <input
                className="ui-input"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </label>
            <div style={{ overflowX: "auto" }}>
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Bill</th>
                    <th className="numeric">Amount</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => {
                    const paidTxn = billStatus.get(bill.id);
                    const dueSmart = selectedIsCurrentMonth ? billDueBadgeLabel(bill.dueDay) : null;
                    const dueTone =
                      dueSmart === "Overdue" ? "danger" : dueSmart === "Due today" ? "neutral" : "brand";
                    return (
                      <tr key={bill.id}>
                        <td>{bill.name}</td>
                        <td className="numeric">${bill.defaultAmount.toFixed(2)}</td>
                        <td>
                          {dueSmart != null ? (
                            <Badge tone={paidTxn ? "neutral" : dueTone}>{dueSmart}</Badge>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                              Day {bill.dueDay}
                            </span>
                          )}
                        </td>
                        <td>
                          {paidTxn ? (
                            <Badge tone="success">Paid</Badge>
                          ) : (
                            <Badge tone="neutral">Unpaid</Badge>
                          )}
                        </td>
                        <td>
                          {!paidTxn ? (
                            <Button variant="outline" size="sm" onClick={() => void markBillPaid(bill)}>
                              Mark paid
                            </Button>
                          ) : (
                            <Button variant="destructive" size="sm" onClick={() => void undoBillPaid(bill.id)}>
                              Undo
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {activeTab === "budget" ? (
          <div style={{ display: "grid", gap: 10 }}>
            <label className="ui-label" style={{ maxWidth: 280 }}>
              Weekly pay
              <input
                className="ui-input"
                type="number"
                step="0.01"
                min={0}
                value={weeklyPay}
                onChange={(e) => setWeeklyPay(e.target.value)}
              />
            </label>
            {allocationRows.map((row, idx) => (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gap: 8,
                  gridTemplateColumns: "2fr 1fr auto",
                  alignItems: "center",
                }}
              >
                <select
                  className="ui-select"
                  value={row.accountId}
                  onChange={(e) =>
                    updateAllocationRow(idx, { accountId: e.target.value })
                  }
                >
                  <option value="">Select account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {formatAccountOptionLabel(account)}
                    </option>
                  ))}
                </select>
                <input
                  className="ui-input"
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  placeholder="%"
                  value={row.percent}
                  onChange={(e) => updateAllocationRow(idx, { percent: e.target.value })}
                />
                <Button variant="ghost" size="sm" type="button" onClick={() => removeAllocationRow(idx)}>
                  Remove
                </Button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="outline" size="md" type="button" onClick={addAllocationRow}>
                Add account
              </Button>
              <Button variant="primary" size="md" type="button" onClick={() => void submitBudgetAllocation()}>
                Submit weekly pay
              </Button>
            </div>
            {budgetResult ? (
              <p style={{ color: "#15803d", fontSize: "0.875rem" }}>{budgetResult}</p>
            ) : null}
          </div>
        ) : null}

        {activeTab === "credit" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "0.9rem" }}>Credit</strong>
              <Button variant="outline" size="sm" type="button" onClick={openCreditModal}>
                Add Credit Account
              </Button>
            </div>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Click a card to enter your actual statement balance; we post a ledger adjustment so the running
              balance matches.
            </p>
            {creditAccounts.map((account) => (
              <div key={account.id} style={{ display: "grid", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => toggleCreditExpand(account)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                    borderRadius: 12,
                    background: "transparent",
                    padding: 0,
                    margin: 0,
                    font: "inherit",
                    border:
                      creditExpandedId === account.id
                        ? "2px solid var(--brand)"
                        : "1px solid transparent",
                  }}
                  aria-expanded={creditExpandedId === account.id}
                >
                  <StatePanel
                    title={account.name}
                    message={`Owed: $${(balances.get(account.id) ?? 0).toFixed(2)} · APR: ${
                      account.annualRatePercent == null
                        ? "n/a"
                        : `${account.annualRatePercent.toFixed(2)}%`
                    }`}
                  />
                </button>
                {creditExpandedId === account.id ? (
                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      paddingBottom: 4,
                      borderLeft: "3px solid var(--brand-soft)",
                      marginLeft: 6,
                      paddingLeft: 12,
                    }}
                  >
                    <label className="ui-label">
                      Actual balance owed (from statement)
                      <input
                        className="ui-input"
                        type="number"
                        step="0.01"
                        value={creditTargetBalance}
                        onChange={(e) => setCreditTargetBalance(e.target.value)}
                        disabled={creditBalanceSubmitting}
                        autoComplete="off"
                      />
                    </label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <Button
                        variant="primary"
                        size="md"
                        type="button"
                        disabled={creditBalanceSubmitting}
                        onClick={() => void submitCreditBalanceReconciliation()}
                      >
                        Add current balance
                      </Button>
                      <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                        Ledger today: ${(balances.get(account.id) ?? 0).toFixed(2)} → matches your entry via a
                        reconciliation transaction.
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
            {creditAccounts.length === 0 ? (
              <StatePanel title="No credit accounts" message="Add credit accounts in Settings/Accounts." />
            ) : null}
          </div>
        ) : null}

        {activeTab === "debit" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "0.9rem" }}>Debit</strong>
              <Button variant="outline" size="sm" type="button" onClick={openDebitModal}>
                Add Debit Account
              </Button>
            </div>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Click a card to set your initial/current loan balance; we post a ledger adjustment so the running
              balance matches.
            </p>
            {debitAccounts.map((account) => (
              <div key={account.id} style={{ display: "grid", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => toggleDebitExpand(account)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                    borderRadius: 12,
                    background: "transparent",
                    padding: 0,
                    margin: 0,
                    font: "inherit",
                    border:
                      debitExpandedId === account.id
                        ? "2px solid var(--brand)"
                        : "1px solid transparent",
                  }}
                  aria-expanded={debitExpandedId === account.id}
                >
                  <StatePanel
                    title={account.name}
                    message={`Balance owed: $${(balances.get(account.id) ?? 0).toFixed(2)} · APR: ${
                      account.annualRatePercent == null
                        ? "n/a"
                        : `${account.annualRatePercent.toFixed(2)}%`
                    }`}
                  />
                </button>
                {debitExpandedId === account.id ? (
                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      paddingBottom: 4,
                      borderLeft: "3px solid var(--brand-soft)",
                      marginLeft: 6,
                      paddingLeft: 12,
                    }}
                  >
                    <label className="ui-label">
                      Actual balance owed (from lender statement)
                      <input
                        className="ui-input"
                        type="number"
                        step="0.01"
                        value={debitTargetBalance}
                        onChange={(e) => setDebitTargetBalance(e.target.value)}
                        disabled={debitBalanceSubmitting}
                        autoComplete="off"
                      />
                    </label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <Button
                        variant="primary"
                        size="md"
                        type="button"
                        disabled={debitBalanceSubmitting}
                        onClick={() => void submitDebitBalanceReconciliation()}
                      >
                        Set initial balance
                      </Button>
                      <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                        Ledger today: ${(balances.get(account.id) ?? 0).toFixed(2)} → matches your entry via a
                        reconciliation transaction.
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
            {debitAccounts.length === 0 ? (
              <StatePanel title="No debit/loan accounts" message="Add loan accounts in Settings/Accounts." />
            ) : null}
          </div>
        ) : null}

        {activeTab === "investments" ? (
          <InvestmentsTab />
        ) : null}
        {activeTab === "fire" ? (
          <FireTab />
        ) : null}
      </Card>

      {addModal ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(15, 23, 42, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={closeAddModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-add-modal-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(100%, 440px)",
              maxHeight: "90vh",
              overflow: "auto",
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderLeft: "4px solid var(--brand)",
              borderRadius: "var(--radius-lg)",
              boxShadow:
                "0 0 0 1px var(--brand-soft), 0 18px 48px -14px rgba(15, 23, 42, 0.22)",
              padding: "1.25rem 1.35rem 1.25rem 1.3rem",
              display: "grid",
              gap: "1rem",
            }}
          >
            <h2
              id="finance-add-modal-title"
              style={{
                fontSize: "1.0625rem",
                fontWeight: 600,
                color: "var(--text)",
                margin: 0,
                letterSpacing: "-0.01em",
                paddingBottom: 2,
                borderBottom: "1px solid var(--line)",
              }}
            >
              {addModal === "bill"
                ? "Add bill"
                : addModal === "credit"
                  ? "Add credit account"
                  : "Add loan account"}
            </h2>
            {modalError ? (
              <p style={{ color: "var(--destructive)", fontSize: "0.875rem", margin: 0 }}>{modalError}</p>
            ) : null}

            <div style={{ display: "grid", gap: "0.9rem" }}>
              {addModal === "bill" ? (
                <>
                  <label className="ui-label">
                    Name
                    <input
                      className="ui-input"
                      type="text"
                      value={billName}
                      onChange={(e) => setBillName(e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <label className="ui-label">
                    Default amount
                    <input
                      className="ui-input"
                      type="number"
                      step="0.01"
                      min={0}
                      value={billDefaultAmount}
                      onChange={(e) => setBillDefaultAmount(e.target.value)}
                    />
                  </label>
                  <label className="ui-label">
                    Due day (1–31)
                    <input
                      className="ui-input"
                      type="number"
                      min={1}
                      max={31}
                      value={billDueDay}
                      onChange={(e) => setBillDueDay(e.target.value)}
                    />
                  </label>
                  <div className="ui-label">
                    Active
                    <label
                      htmlFor="finance-modal-bill-active"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        cursor: "pointer",
                        color: "var(--text)",
                        fontSize: "0.875rem",
                        margin: 0,
                        minHeight: "2.25rem",
                        padding: "0.2rem 0",
                      }}
                    >
                      <input
                        id="finance-modal-bill-active"
                        type="checkbox"
                        checked={billActive}
                        onChange={(e) => setBillActive(e.target.checked)}
                        style={{
                          width: "1rem",
                          height: "1rem",
                          margin: 0,
                          flexShrink: 0,
                          accentColor: "var(--brand)",
                        }}
                      />
                      <span>Bill is active and shown in the workspace</span>
                    </label>
                  </div>
                  <label className="ui-label">
                    Due group (optional)
                    <input
                      className="ui-input"
                      type="text"
                      value={billDueGroup}
                      onChange={(e) => setBillDueGroup(e.target.value)}
                    />
                  </label>
                  <label className="ui-label">
                    Category (optional)
                    <input
                      className="ui-input"
                      type="text"
                      value={billCategory}
                      onChange={(e) => setBillCategory(e.target.value)}
                    />
                  </label>
                  <label className="ui-label">
                    Default from account (optional)
                    <select
                      className="ui-select"
                      value={billFromAccountId}
                      onChange={(e) => setBillFromAccountId(e.target.value)}
                    >
                      <option value="">None</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {formatAccountOptionLabel(account)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ui-label">
                    Default to account (optional)
                    <select
                      className="ui-select"
                      value={billToAccountId}
                      onChange={(e) => setBillToAccountId(e.target.value)}
                    >
                      <option value="">None</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {formatAccountOptionLabel(account)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label className="ui-label">
                    Name
                    <input
                      className="ui-input"
                      type="text"
                      value={accName}
                      onChange={(e) => setAccName(e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <label className="ui-label">
                    Owner
                    <select
                      className="ui-select"
                      value={accOwnerType}
                      onChange={(e) => setAccOwnerType(e.target.value as "PERSONAL" | "BUSINESS")}
                    >
                      <option value="PERSONAL">Personal</option>
                      <option value="BUSINESS">Business</option>
                    </select>
                  </label>
                  <label className="ui-label">
                    Starting balance
                    <input
                      className="ui-input"
                      type="number"
                      step="0.01"
                      value={accStartingBalance}
                      onChange={(e) => setAccStartingBalance(e.target.value)}
                    />
                  </label>
                  <div className="ui-label">
                    Active
                    <label
                      htmlFor="finance-modal-account-active"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        cursor: "pointer",
                        color: "var(--text)",
                        fontSize: "0.875rem",
                        margin: 0,
                        minHeight: "2.25rem",
                        padding: "0.2rem 0",
                      }}
                    >
                      <input
                        id="finance-modal-account-active"
                        type="checkbox"
                        checked={accIsActive}
                        onChange={(e) => setAccIsActive(e.target.checked)}
                        style={{
                          width: "1rem",
                          height: "1rem",
                          margin: 0,
                          flexShrink: 0,
                          accentColor: "var(--brand)",
                        }}
                      />
                      <span>Account is active</span>
                    </label>
                  </div>
                  <label className="ui-label">
                    APR % (optional)
                    <input
                      className="ui-input"
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      value={accApr}
                      onChange={(e) => setAccApr(e.target.value)}
                    />
                  </label>
                  <label className="ui-label">
                    Limit (optional)
                    <input
                      className="ui-input"
                      type="number"
                      step="0.01"
                      min={0}
                      value={accLimit}
                      onChange={(e) => setAccLimit(e.target.value)}
                    />
                  </label>
                  <label className="ui-label">
                    Starting date (optional)
                    <input
                      className="ui-input"
                      type="date"
                      value={accStartingDate}
                      onChange={(e) => setAccStartingDate(e.target.value)}
                    />
                  </label>
                </>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                justifyContent: "flex-end",
                flexWrap: "wrap",
                paddingTop: "0.35rem",
                marginTop: "0.15rem",
                borderTop: "1px solid var(--line)",
              }}
            >
              <Button variant="outline" size="md" type="button" onClick={closeAddModal} disabled={modalSubmitting}>
                Cancel
              </Button>
              {addModal === "bill" ? (
                <Button
                  variant="primary"
                  size="md"
                  type="button"
                  disabled={modalSubmitting}
                  onClick={() => void submitBillModal()}
                >
                  Create
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  type="button"
                  disabled={modalSubmitting}
                  onClick={() => void submitAccountModal(addModal === "credit" ? "CREDIT" : "LOAN")}
                >
                  Create
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
