import { fetchPaginatedList } from "@/lib/api/client-fetch";
import type { Account, Transaction } from "@/lib/types/domain";

export type AccountsBundle = {
  accounts: Account[];
  transactions: Transaction[];
};

export async function fetchAccountsBundle(): Promise<AccountsBundle> {
  const [accounts, transactions] = await Promise.all([
    fetchPaginatedList<Account>("/api/accounts"),
    fetchPaginatedList<Transaction>("/api/transactions"),
  ]);
  return { accounts, transactions };
}
