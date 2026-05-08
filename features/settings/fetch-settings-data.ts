import { fetchPaginatedList } from "@/lib/api/client-fetch";
import type { Account, Bill } from "@/lib/types/domain";

export type SettingsData = {
  accounts: Account[];
  bills: Bill[];
};

export async function fetchSettingsData(): Promise<SettingsData> {
  const [accounts, bills] = await Promise.all([
    fetchPaginatedList<Account>("/api/accounts"),
    fetchPaginatedList<Bill>("/api/bills"),
  ]);
  return { accounts, bills };
}
