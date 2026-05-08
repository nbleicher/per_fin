"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  fetchTransactionsList,
  fetchTransactionsRefs,
} from "@/features/transactions/fetch-transactions-page";
import {
  CHATBOT_DRAFT_APPLY_EVENT,
  type ChatbotDraftApplyDetail,
} from "@/lib/chatbot/autofill/events";
import { queryKeys } from "@/lib/query-keys";
import {
  type Transaction,
  type AccountSubtype,
  type OwnerType,
  type TransactionType,
} from "@/lib/types/domain";

type ApiSuccess<T> = { ok: true; data: T };
type ApiError = { ok: false; error: { code: string; message: string } };

function toDateInputValue(iso: string) {
  return iso.slice(0, 10);
}

function toISODateFromInput(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const [accountFilter, setAccountFilter] = useState("");
  const [ownerScope, setOwnerScope] = useState<"" | OwnerType>("");
  const [subtypeScope, setSubtypeScope] = useState<"" | AccountSubtype>("");
  const [typeFilter, setTypeFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  const listFilters = useMemo(
    () => ({
      accountFilter,
      typeFilter,
      monthFilter,
      searchFilter,
    }),
    [accountFilter, typeFilter, monthFilter, searchFilter],
  );

  const refsQuery = useQuery({
    queryKey: queryKeys.transactions.refs,
    queryFn: fetchTransactionsRefs,
  });

  const listQuery = useQuery({
    queryKey: queryKeys.transactions.list(listFilters),
    queryFn: () => fetchTransactionsList(listFilters),
    enabled: refsQuery.isSuccess,
  });

  const accounts = useMemo(() => refsQuery.data?.accounts ?? [], [refsQuery.data]);
  const bills = useMemo(() => refsQuery.data?.bills ?? [], [refsQuery.data]);
  const transactions = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  const loading = refsQuery.isFetching || listQuery.isFetching;
  const loadError =
    (refsQuery.error &&
      (refsQuery.error instanceof Error ? refsQuery.error.message : String(refsQuery.error))) ||
    (listQuery.error &&
      (listQuery.error instanceof Error ? listQuery.error.message : String(listQuery.error))) ||
    null;

  const [error, setError] = useState<string | null>(null);

  const [editId, setEditId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<TransactionType>("EXPENSE");
  const [source, setSource] = useState<"MANUAL" | "ALLOCATION" | "IMPORT" | "BILL_PAYMENT">("MANUAL");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [billId, setBillId] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");

  const invalidateTransactionQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.bundle }),
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.bundle }),
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.workspace }),
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.data }),
    ]);
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<ChatbotDraftApplyDetail>;
      const incoming = custom.detail.transactions[0];
      if (!incoming) return;
      const shouldSet = (current: string) => custom.detail.replaceExisting || current.trim().length === 0;
      if (incoming.date && shouldSet(date)) {
        setDate(toDateInputValue(incoming.date));
      }
      if (incoming.description && shouldSet(description)) {
        setDescription(incoming.description);
      }
      if (typeof incoming.amount === "number" && Number.isFinite(incoming.amount) && shouldSet(amount)) {
        setAmount(String(incoming.amount));
      }
      if (incoming.type && (custom.detail.replaceExisting || type === "EXPENSE")) {
        setType(incoming.type);
      }
      if (incoming.source && (custom.detail.replaceExisting || source === "MANUAL")) {
        setSource(incoming.source);
      }
      if (incoming.fromAccountId != null && (custom.detail.replaceExisting || !fromAccountId)) {
        setFromAccountId(String(incoming.fromAccountId));
      }
      if (incoming.toAccountId != null && (custom.detail.replaceExisting || !toAccountId)) {
        setToAccountId(String(incoming.toAccountId));
      }
      if (incoming.billId != null && (custom.detail.replaceExisting || !billId)) {
        setBillId(String(incoming.billId));
      }
      if (incoming.category && shouldSet(category)) {
        setCategory(incoming.category);
      }
      if (incoming.notes && shouldSet(notes)) {
        setNotes(incoming.notes);
      }
      if (custom.detail.transactions.length > 1) {
        const queueNote = `Chatbot prepared ${custom.detail.transactions.length} transaction drafts; form populated with first draft.`;
        setNotes((prev) => (shouldSet(prev) ? queueNote : prev));
      }
    };
    window.addEventListener(CHATBOT_DRAFT_APPLY_EVENT, handler as EventListener);
    return () => window.removeEventListener(CHATBOT_DRAFT_APPLY_EVENT, handler as EventListener);
  }, [amount, billId, category, date, description, fromAccountId, notes, source, toAccountId, type]);

  const resetForm = () => {
    setEditId(null);
    setDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setAmount("");
    setType("EXPENSE");
    setSource("MANUAL");
    setFromAccountId("");
    setToAccountId("");
    setBillId("");
    setCategory("");
    setNotes("");
  };

  const months = useMemo(() => {
    const set = new Set(transactions.map((txn) => txn.yearMonth));
    return [...set].sort().reverse();
  }, [transactions]);

  const scopedAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          (ownerScope ? account.ownerType === ownerScope : true) &&
          (subtypeScope ? account.accountSubtype === subtypeScope : true),
      ),
    [accounts, ownerScope, subtypeScope],
  );

  const accountNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const account of accounts) {
      map.set(account.id, account.name);
    }
    return map;
  }, [accounts]);

  const onEdit = (txn: Transaction) => {
    setEditId(txn.id);
    setDate(toDateInputValue(txn.date));
    setDescription(txn.description);
    setAmount(String(txn.amount));
    setType(txn.type);
    setSource(txn.source);
    setFromAccountId(txn.fromAccountId ? String(txn.fromAccountId) : "");
    setToAccountId(txn.toAccountId ? String(txn.toAccountId) : "");
    setBillId(txn.billId ? String(txn.billId) : "");
    setCategory(txn.category ?? "");
    setNotes(txn.notes ?? "");
  };

  const onDelete = async (id: number) => {
    setError(null);
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to delete transaction.");
      return;
    }
    await invalidateTransactionQueries();
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Amount must be a positive number.");
      return;
    }
    const payload = {
      date: toISODateFromInput(date),
      description: description.trim(),
      amount: parsedAmount,
      type,
      source,
      fromAccountId: fromAccountId ? Number(fromAccountId) : null,
      toAccountId: toAccountId ? Number(toAccountId) : null,
      billId: billId ? Number(billId) : null,
      category: category.trim() || null,
      notes: notes.trim() || null,
    };
    const endpoint = editId ? `/api/transactions/${editId}` : "/api/transactions";
    const method = editId ? "PATCH" : "POST";
    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => null)) as ApiSuccess<Transaction> | ApiError | null;
    if (!res.ok || !body?.ok) {
      setError(body && !body.ok ? body.error.message : "Failed to save transaction.");
      return;
    }
    resetForm();
    await invalidateTransactionQueries();
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Card title="Transaction Form" description="Create, edit, and save transaction rows.">
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 8 }}>
          <div className="ui-field-grid">
            <select className="ui-select" value={ownerScope} onChange={(e) => setOwnerScope(e.target.value as "" | OwnerType)}>
              <option value="">All owners (scope)</option>
              <option value="PERSONAL">Personal</option>
              <option value="BUSINESS">Business</option>
            </select>
            <select className="ui-select" value={subtypeScope} onChange={(e) => setSubtypeScope(e.target.value as "" | AccountSubtype)}>
              <option value="">All subtypes (scope)</option>
              <option value="CHECKING">Checking</option>
              <option value="SAVINGS">Savings</option>
              <option value="CREDIT">Credit</option>
              <option value="LOAN">Loan (Debit)</option>
              <option value="INVESTMENT">Investment</option>
            </select>
            <input className="ui-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <input className="ui-input" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <input className="ui-input" placeholder="Amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <select className="ui-select" value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
              <option value="TRANSFER">Transfer</option>
            </select>
            <select className="ui-select" value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
              <option value="MANUAL">Manual</option>
              <option value="ALLOCATION">Allocation</option>
              <option value="BILL_PAYMENT">Bill Payment</option>
              <option value="IMPORT">Import</option>
            </select>
            <select className="ui-select" value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)}>
              <option value="">From account (optional)</option>
              {scopedAccounts.map((account) => (
                <option key={`from-${account.id}`} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            <select className="ui-select" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
              <option value="">To account (optional)</option>
              {scopedAccounts.map((account) => (
                <option key={`to-${account.id}`} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            <select className="ui-select" value={billId} onChange={(e) => setBillId(e.target.value)}>
              <option value="">Bill (optional)</option>
              {bills.map((bill) => (
                <option key={bill.id} value={bill.id}>
                  {bill.name}
                </option>
              ))}
            </select>
            <input className="ui-input" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
            <input className="ui-input" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" size="md" type="submit">
              {editId ? "Update transaction" : "Add transaction"}
            </Button>
            {editId ? (
              <Button variant="ghost" size="md" type="button" onClick={resetForm}>
                Cancel edit
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      <Card title="Transaction Filters" description="Filter by account, type, month, and text.">
        <div className="ui-field-grid">
          <select className="ui-select" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <select className="ui-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
            <option value="TRANSFER">Transfer</option>
          </select>
          <select className="ui-select" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="">All months</option>
            {months.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
          <input
            className="ui-input"
            placeholder="Search description/category/notes"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>
      </Card>

      <Card title="Transactions Ledger" description="Most recent rows first.">
        {loading ? <p>Loading transactions...</p> : null}
        {loadError ? (
          <p style={{ color: "var(--destructive)", fontSize: "0.875rem" }}>{loadError}</p>
        ) : null}
        {error ? <p style={{ color: "var(--destructive)", fontSize: "0.875rem" }}>{error}</p> : null}
        {!loading ? (
          <div style={{ overflowX: "auto" }}>
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th className="numeric">Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr key={txn.id}>
                    <td>{toDateInputValue(txn.date)}</td>
                    <td>{txn.description}</td>
                    <td>{txn.type}</td>
                    <td>{txn.fromAccountId ? (accountNameById.get(txn.fromAccountId) ?? "—") : "—"}</td>
                    <td>{txn.toAccountId ? (accountNameById.get(txn.toAccountId) ?? "—") : "—"}</td>
                    <td className="numeric">${txn.amount.toFixed(2)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Button variant="outline" size="sm" type="button" onClick={() => onEdit(txn)}>
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" type="button" onClick={() => void onDelete(txn.id)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "0.75rem", color: "var(--text-muted)" }}>
                      No transactions matched the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
