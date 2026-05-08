export type TransactionListFilters = {
  accountFilter: string;
  typeFilter: string;
  monthFilter: string;
  searchFilter: string;
};

export const queryKeys = {
  dashboard: {
    all: ["dashboard"] as const,
    bundle: ["dashboard", "bundle"] as const,
  },
  finance: {
    workspace: ["finance", "workspace"] as const,
  },
  accounts: {
    bundle: ["accounts", "bundle"] as const,
  },
  settings: {
    data: ["settings", "accounts-bills"] as const,
  },
  transactions: {
    refs: ["transactions", "refs"] as const,
    list: (f: TransactionListFilters) =>
      [
        "transactions",
        "list",
        f.accountFilter,
        f.typeFilter,
        f.monthFilter,
        f.searchFilter,
      ] as const,
  },
  strategy: {
    roadmap: ["strategy", "roadmap"] as const,
  },
} as const;
