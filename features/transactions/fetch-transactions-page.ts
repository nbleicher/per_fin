import { fetchPaginatedList } from "@/lib/api/client-fetch";
import type { TransactionListFilters } from "@/lib/query-keys";
import type { Account, Bill, Transaction } from "@/lib/types/domain";

export type TransactionsRefs = {
  accounts: Account[];
  bills: Bill[];
};

export async function fetchTransactionsRefs(): Promise<TransactionsRefs> {
  const [accounts, bills] = await Promise.all([
    fetchPaginatedList<Account>("/api/accounts"),
    fetchPaginatedList<Bill>("/api/bills"),
  ]);
  return { accounts, bills };
}

export async function fetchTransactionsList(filters: TransactionListFilters): Promise<Transaction[]> {
  const params = new URLSearchParams();
  if (filters.accountFilter) params.set("accountId", filters.accountFilter);
  if (filters.typeFilter) params.set("type", filters.typeFilter);
  if (filters.monthFilter) params.set("month", filters.monthFilter);
  if (filters.searchFilter.trim()) params.set("search", filters.searchFilter.trim());
  params.set("pageSize", "100");
  const qs = params.toString();
  const path = qs ? `/api/transactions?${qs}` : "/api/transactions?pageSize=100";
  return fetchPaginatedList<Transaction>(path);
}
