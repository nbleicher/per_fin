"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Account } from "@/lib/types/domain";
import { Tabs, type TabOption } from "@/components/ui/tabs";
import { computeAccountBalances, isAssetSubtype } from "@/lib/finance/balances";
import { fetchAccountsBundle } from "@/features/accounts/fetch-accounts-bundle";
import { queryKeys } from "@/lib/query-keys";

function formatDate(value: string) {
  return value.slice(0, 10);
}

export function AccountsPage() {
  const queryClient = useQueryClient();
  const { data, isFetching, error: queryError } = useQuery({
    queryKey: queryKeys.accounts.bundle,
    queryFn: fetchAccountsBundle,
  });

  const accounts = useMemo(() => data?.accounts ?? [], [data]);
  const transactions = useMemo(() => data?.transactions ?? [], [data]);

  const loadError =
    queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;

  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [ownerTab, setOwnerTab] = useState<"PERSONAL" | "BUSINESS">("PERSONAL");
  const [subtypeTab, setSubtypeTab] = useState<
    "CHECKING" | "SAVINGS" | "CREDIT" | "LOAN" | "INVESTMENT"
  >("CHECKING");
  const [error, setError] = useState<string | null>(null);
  const loading = isFetching;
  const [editRate, setEditRate] = useState("");
  const [editName, setEditName] = useState("");

  const accountById = useMemo(() => {
    const map = new Map<number, Account>();
    for (const account of accounts) {
      map.set(account.id, account);
    }
    return map;
  }, [accounts]);

  const accountBalances = useMemo(() => {
    return computeAccountBalances(accounts, transactions);
  }, [accounts, transactions]);

  const selectedAccount = selectedAccountId ? accountById.get(selectedAccountId) ?? null : null;

  useEffect(() => {
    if (!selectedAccount) return;
    setEditName(selectedAccount.name);
    setEditRate(
      selectedAccount.annualRatePercent == null
        ? ""
        : String(selectedAccount.annualRatePercent),
    );
  }, [selectedAccount]);

  const selectedTimeline = useMemo(() => {
    if (!selectedAccount) return [];
    const linked = transactions
      .filter((txn) => txn.fromAccountId === selectedAccount.id || txn.toAccountId === selectedAccount.id)
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    let running = selectedAccount.startingBalance ?? 0;
    return linked.map((txn) => {
      const fromMatch = txn.fromAccountId === selectedAccount.id;
      const toMatch = txn.toAccountId === selectedAccount.id;
      if (fromMatch) {
        running = isAssetSubtype(selectedAccount.accountSubtype) ? running - txn.amount : running + txn.amount;
      }
      if (toMatch) {
        running = isAssetSubtype(selectedAccount.accountSubtype) ? running + txn.amount : running - txn.amount;
      }
      const directionAmount = fromMatch ? -txn.amount : txn.amount;
      return { txn, running, directionAmount };
    });
  }, [selectedAccount, transactions]);

  const ownerTabs: TabOption[] = [
    { id: "PERSONAL", label: "Personal" },
    { id: "BUSINESS", label: "Business" },
  ];
  const subtypeTabs: TabOption[] = [
    { id: "CHECKING", label: "Checking" },
    { id: "SAVINGS", label: "Savings" },
    { id: "CREDIT", label: "Credit" },
    { id: "LOAN", label: "Debit" },
    { id: "INVESTMENT", label: "Investment" },
  ];

  const visibleAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          account.ownerType === ownerTab && account.accountSubtype === subtypeTab,
      ),
    [accounts, ownerTab, subtypeTab],
  );

  const saveSelectedAccount = async () => {
    if (!selectedAccount) return;
    setError(null);
    const payload = {
      name: editName.trim() || selectedAccount.name,
      annualRatePercent: editRate.trim() === "" ? null : Number(editRate),
    };
    const res = await fetch(`/api/accounts/${selectedAccount.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setError("Failed to update selected account.");
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.bundle }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.bundle }),
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.data }),
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.workspace }),
    ]);
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Card title="Accounts Overview" description="Select an account to inspect running balance history.">
        <Tabs
          options={ownerTabs}
          activeId={ownerTab}
          onChange={(id) => {
            setOwnerTab(id as "PERSONAL" | "BUSINESS");
            setSelectedAccountId(null);
          }}
        />
        <Tabs
          options={subtypeTabs}
          activeId={subtypeTab}
          onChange={(id) => {
            setSubtypeTab(
              id as "CHECKING" | "SAVINGS" | "CREDIT" | "LOAN" | "INVESTMENT",
            );
            setSelectedAccountId(null);
          }}
        />
        {loading ? <p>Loading accounts...</p> : null}
        {loadError ? (
          <p style={{ color: "var(--destructive)", fontSize: "0.875rem" }}>{loadError}</p>
        ) : null}
        {error ? <p style={{ color: "var(--destructive)", fontSize: "0.875rem" }}>{error}</p> : null}
        <div className="ui-field-grid">
          {visibleAccounts.map((account) => {
            const balance = accountBalances.get(account.id) ?? 0;
            return (
              <button
                key={account.id}
                type="button"
                className="ui-pick-card"
                data-selected={selectedAccountId === account.id ? "true" : "false"}
                onClick={() => setSelectedAccountId(account.id)}
              >
                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{account.accountSubtype}</div>
                <div style={{ fontWeight: 600 }}>{account.name}</div>
                <div style={{ marginTop: 4 }}>${balance.toFixed(2)}</div>
              </button>
            );
          })}
          {visibleAccounts.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>
              No accounts under this owner/subtype yet.
            </p>
          ) : null}
        </div>
      </Card>

      <Card title="Account Detail" description={selectedAccount ? selectedAccount.name : "Choose an account above."}>
        {!selectedAccount ? <p style={{ color: "var(--text-muted)" }}>No account selected.</p> : null}
        {selectedAccount ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="ui-field-grid">
              <input
                className="ui-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Account name"
              />
              <input
                className="ui-input"
                type="number"
                step="0.01"
                value={editRate}
                onChange={(e) => setEditRate(e.target.value)}
                placeholder="Annual rate % (optional)"
              />
              <Button variant="primary" size="md" type="button" onClick={() => void saveSelectedAccount()}>
                Save account details
              </Button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th className="numeric">Amount</th>
                    <th className="numeric">Running Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTimeline.map((row) => (
                    <tr key={row.txn.id}>
                      <td>{formatDate(row.txn.date)}</td>
                      <td>{row.txn.description}</td>
                      <td>{row.txn.type}</td>
                      <td className="numeric">
                        {row.directionAmount >= 0 ? "+" : "-"}${Math.abs(row.directionAmount).toFixed(2)}
                      </td>
                      <td className="numeric">${row.running.toFixed(2)}</td>
                    </tr>
                  ))}
                  {selectedTimeline.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: "0.75rem", color: "var(--text-muted)" }}>
                        No transactions for this account.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
