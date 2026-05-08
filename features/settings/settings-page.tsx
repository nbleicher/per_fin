"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Account, AccountSubtype, Bill, OwnerType } from "@/lib/types/domain";
import {
  CHATBOT_DRAFT_APPLY_EVENT,
  type ChatbotDraftApplyDetail,
} from "@/lib/chatbot/autofill/events";
import { fetchSettingsData } from "@/features/settings/fetch-settings-data";
import { queryKeys } from "@/lib/query-keys";

type ApiSuccess<T> = { ok: true; data: T };
type ApiError = { ok: false; error: { code: string; message: string } };

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isFetching, error: queryError } = useQuery({
    queryKey: queryKeys.settings.data,
    queryFn: fetchSettingsData,
  });

  const accounts = useMemo(() => data?.accounts ?? [], [data]);
  const bills = useMemo(() => data?.bills ?? [], [data]);

  const loadError =
    queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;

  const [error, setError] = useState<string | null>(null);
  const loading = isFetching;

  const [accountName, setAccountName] = useState("");
  const [ownerType, setOwnerType] = useState<OwnerType>("PERSONAL");
  const [accountSubtype, setAccountSubtype] = useState<AccountSubtype>("CHECKING");
  const [annualRatePercent, setAnnualRatePercent] = useState("");

  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billDueDay, setBillDueDay] = useState("");
  const [billFromAccountId, setBillFromAccountId] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);

  const invalidateDependentData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.data }),
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.bundle }),
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.workspace }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.bundle }),
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
    ]);
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<ChatbotDraftApplyDetail>;
      const replaceExisting = custom.detail.replaceExisting;
      const account = custom.detail.accounts[0];
      const bill = custom.detail.bills[0];

      const canSet = (current: string) => replaceExisting || current.trim().length === 0;

      if (account) {
        if (account.name && canSet(accountName)) {
          setAccountName(account.name);
        }
        if (account.ownerType && (replaceExisting || ownerType === "PERSONAL")) {
          setOwnerType(account.ownerType as OwnerType);
        }
        if (account.accountSubtype && (replaceExisting || accountSubtype === "CHECKING")) {
          setAccountSubtype(account.accountSubtype as AccountSubtype);
        }
        if (account.annualRatePercent != null && (replaceExisting || !annualRatePercent)) {
          setAnnualRatePercent(String(account.annualRatePercent));
        }
      }

      if (bill) {
        if (bill.name && canSet(billName)) {
          setBillName(bill.name);
        }
        if (bill.defaultAmount != null && (replaceExisting || !billAmount)) {
          setBillAmount(String(bill.defaultAmount));
        }
        if (bill.dueDay != null && (replaceExisting || !billDueDay)) {
          setBillDueDay(String(bill.dueDay));
        }
        if (bill.defaultFromAccountId != null && (replaceExisting || !billFromAccountId)) {
          setBillFromAccountId(String(bill.defaultFromAccountId));
        }
      }
    };

    window.addEventListener(CHATBOT_DRAFT_APPLY_EVENT, handler as EventListener);
    return () => window.removeEventListener(CHATBOT_DRAFT_APPLY_EVENT, handler as EventListener);
  }, [
    accountName,
    accountSubtype,
    annualRatePercent,
    billAmount,
    billDueDay,
    billFromAccountId,
    billName,
    ownerType,
  ]);

  const createAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const rate = annualRatePercent.trim() ? Number(annualRatePercent) : null;
    const payload = {
      name: accountName.trim(),
      ownerType,
      accountSubtype,
      annualRatePercent: rate,
      startingBalance: 0,
      isActive: true,
    };
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => null)) as ApiSuccess<Account> | ApiError | null;
    if (!res.ok || !body?.ok) {
      setError(body && !body.ok ? body.error.message : "Failed to create account.");
      return;
    }
    setAccountName("");
    setAnnualRatePercent("");
    await invalidateDependentData();
  };

  const createBill = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const payload = {
      name: billName.trim(),
      defaultAmount: Number(billAmount),
      dueDay: Number(billDueDay),
      defaultFromAccountId: billFromAccountId ? Number(billFromAccountId) : null,
      active: true,
    };
    const res = await fetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => null)) as ApiSuccess<Bill> | ApiError | null;
    if (!res.ok || !body?.ok) {
      setError(body && !body.ok ? body.error.message : "Failed to create bill.");
      return;
    }
    setBillName("");
    setBillAmount("");
    setBillDueDay("");
    setBillFromAccountId("");
    await invalidateDependentData();
  };

  const deleteAccount = async (id: number) => {
    setError(null);
    const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to delete account.");
      return;
    }
    await invalidateDependentData();
  };

  const deleteBill = async (id: number) => {
    setError(null);
    const res = await fetch(`/api/bills/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to delete bill.");
      return;
    }
    await invalidateDependentData();
  };

  const exportData = async () => {
    setError(null);
    const res = await fetch("/api/settings/export");
    const body = (await res.json().catch(() => null)) as
      | ApiSuccess<Record<string, unknown>>
      | ApiError
      | null;
    if (!res.ok || !body?.ok) {
      setError(body && !body.ok ? body.error.message : "Failed to export data.");
      return;
    }
    const blob = new Blob([JSON.stringify(body.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `noah-finance-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const importTransactions = async () => {
    setError(null);
    setImportResult(null);
    if (!importFile) {
      setError("Choose an XLSX file before importing.");
      return;
    }
    const formData = new FormData();
    formData.append("file", importFile);
    const res = await fetch("/api/settings/import", {
      method: "POST",
      body: formData,
    });
    const body = (await res.json().catch(() => null)) as
      | ApiSuccess<{ imported: number; skipped: number; filename: string }>
      | ApiError
      | null;
    if (!res.ok || !body?.ok) {
      setError(body && !body.ok ? body.error.message : "Failed to import transactions.");
      return;
    }
    setImportResult(
      `Imported ${body.data.imported} transaction(s), skipped ${body.data.skipped}.`,
    );
    setImportFile(null);
    await invalidateDependentData();
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Card title="Account Setup" description="Create and manage account records.">
        <form onSubmit={createAccount} style={{ display: "grid", gap: 8 }}>
          <div className="ui-field-grid">
            <input
              className="ui-input"
              placeholder="Account name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
            <select className="ui-select" value={ownerType} onChange={(e) => setOwnerType(e.target.value as OwnerType)}>
              <option value="PERSONAL">Personal</option>
              <option value="BUSINESS">Business</option>
            </select>
            <select
              className="ui-select"
              value={accountSubtype}
              onChange={(e) => setAccountSubtype(e.target.value as AccountSubtype)}
            >
              <option value="CHECKING">Checking</option>
              <option value="SAVINGS">Savings</option>
              <option value="CREDIT">Credit</option>
              <option value="LOAN">Loan (Debit)</option>
              <option value="INVESTMENT">Investment</option>
            </select>
            <input
              className="ui-input"
              type="number"
              step="0.01"
              placeholder="Annual rate % (optional)"
              value={annualRatePercent}
              onChange={(e) => setAnnualRatePercent(e.target.value)}
            />
          </div>
          <div>
            <Button variant="primary" size="md" type="submit">
              Add account
            </Button>
          </div>
        </form>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table className="ui-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Owner</th>
                <th>Subtype</th>
                <th>Rate</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.name}</td>
                  <td>{account.ownerType}</td>
                  <td>{account.accountSubtype}</td>
                  <td>{account.annualRatePercent == null ? "—" : `${account.annualRatePercent.toFixed(2)}%`}</td>
                  <td>
                    <Button variant="destructive" size="sm" type="button" onClick={() => void deleteAccount(account.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Bill Setup" description="Create and manage recurring bills.">
        <form onSubmit={createBill} style={{ display: "grid", gap: 8 }}>
          <div className="ui-field-grid">
            <input className="ui-input" placeholder="Bill name" value={billName} onChange={(e) => setBillName(e.target.value)} />
            <input
              className="ui-input"
              type="number"
              step="0.01"
              placeholder="Amount"
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
            />
            <input
              className="ui-input"
              type="number"
              min={1}
              max={31}
              placeholder="Due day"
              value={billDueDay}
              onChange={(e) => setBillDueDay(e.target.value)}
            />
            <select className="ui-select" value={billFromAccountId} onChange={(e) => setBillFromAccountId(e.target.value)}>
              <option value="">From account (optional)</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Button variant="primary" size="md" type="submit">
              Add bill
            </Button>
          </div>
        </form>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table className="ui-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="numeric">Amount</th>
                <th>Due Day</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id}>
                  <td>{bill.name}</td>
                  <td className="numeric">${bill.defaultAmount.toFixed(2)}</td>
                  <td>{bill.dueDay}</td>
                  <td>{bill.active ? "Yes" : "No"}</td>
                  <td>
                    <Button variant="destructive" size="sm" type="button" onClick={() => void deleteBill(bill.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Data Tools" description="Export backups and import transaction XLSX files.">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Button variant="outline" size="md" type="button" onClick={() => void exportData()}>
            Export JSON backup
          </Button>
          <input
            className="ui-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
          />
          <Button variant="primary" size="md" type="button" onClick={() => void importTransactions()}>
            Import XLSX transactions
          </Button>
        </div>
        {importResult ? <p style={{ color: "#15803d", fontSize: "0.875rem" }}>{importResult}</p> : null}
      </Card>

      {loading ? <p>Loading settings data...</p> : null}
      {loadError ? (
        <p style={{ color: "var(--destructive)", fontSize: "0.875rem" }}>{loadError}</p>
      ) : null}
      {error ? <p style={{ color: "var(--destructive)", fontSize: "0.875rem" }}>{error}</p> : null}
    </div>
  );
}
