import { fetchPaginatedList } from "@/lib/api/client-fetch";
import type { Account, Bill, Transaction } from "@/lib/types/domain";

export type FinanceWorkspaceData = {
  accounts: Account[];
  bills: Bill[];
  transactions: Transaction[];
};

export async function fetchFinanceWorkspace(): Promise<FinanceWorkspaceData> {
  const [accounts, bills, transactions] = await Promise.all([
    fetchPaginatedList<Account>("/api/accounts"),
    fetchPaginatedList<Bill>("/api/bills"),
    fetchPaginatedList<Transaction>("/api/transactions"),
  ]);
  return { accounts, bills, transactions };
}
