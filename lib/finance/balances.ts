import type { Account, Transaction } from "@/lib/types/domain";

export function isAssetSubtype(subtype: Account["accountSubtype"]) {
  return subtype === "CHECKING" || subtype === "SAVINGS" || subtype === "INVESTMENT";
}

export function computeAccountBalances(accounts: Account[], transactions: Transaction[]) {
  const accountById = new Map<number, Account>();
  const balances = new Map<number, number>();

  for (const account of accounts) {
    accountById.set(account.id, account);
    balances.set(account.id, account.startingBalance ?? 0);
  }

  const ordered = [...transactions].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const txn of ordered) {
    if (txn.fromAccountId && accountById.has(txn.fromAccountId)) {
      const account = accountById.get(txn.fromAccountId);
      if (account) {
        const current = balances.get(txn.fromAccountId) ?? 0;
        balances.set(
          txn.fromAccountId,
          isAssetSubtype(account.accountSubtype) ? current - txn.amount : current + txn.amount,
        );
      }
    }
    if (txn.toAccountId && accountById.has(txn.toAccountId)) {
      const account = accountById.get(txn.toAccountId);
      if (account) {
        const current = balances.get(txn.toAccountId) ?? 0;
        balances.set(
          txn.toAccountId,
          isAssetSubtype(account.accountSubtype) ? current + txn.amount : current - txn.amount,
        );
      }
    }
  }

  return balances;
}
