import { computeAccountBalances } from "@/lib/finance/balances";
import { prisma } from "@/lib/db/prisma";
import type { AccountSnapshot } from "@/lib/types/chatbot";
import type { Account, Transaction } from "@/lib/types/domain";

const STOP_WORDS = new Set([
  "my",
  "the",
  "card",
  "account",
  "balance",
  "what",
  "is",
  "on",
  "for",
]);

const ACCOUNT_ALIASES: Record<string, string[]> = {
  quicksilver: ["quicksilver", "capital one quicksilver", "qs"],
  "nfcu visa": ["nfcu visa", "navy federal visa", "navy federal credit union visa"],
  nfcu: ["nfcu", "navy federal", "navy federal credit union"],
};

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS.has(token))
    .join(" ")
    .trim();
}

function tokenSet(input: string) {
  const normalized = normalizeText(input);
  return new Set(normalized ? normalized.split(" ") : []);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function aliasMatchScore(query: string, accountName: string) {
  const normalizedQuery = normalizeText(query);
  const normalizedName = normalizeText(accountName);
  for (const aliases of Object.values(ACCOUNT_ALIASES)) {
    for (const alias of aliases) {
      const normalizedAlias = normalizeText(alias);
      if (normalizedQuery === normalizedAlias && normalizedName.includes(normalizedAlias)) {
        return 0.95;
      }
    }
  }
  return 0;
}

function scoreAccountMatch(query: string, accountName: string) {
  const normalizedQuery = normalizeText(query);
  const normalizedName = normalizeText(accountName);
  if (!normalizedQuery || !normalizedName) return 0;
  if (normalizedQuery === normalizedName) return 1;

  const aliasScore = aliasMatchScore(query, accountName);
  if (aliasScore > 0) return aliasScore;

  if (normalizedName.includes(normalizedQuery)) return 0.92;
  if (normalizedQuery.includes(normalizedName)) return 0.9;

  const overlap = jaccardSimilarity(tokenSet(query), tokenSet(accountName));
  if (overlap >= 0.75) return 0.88;
  if (overlap >= 0.5) return 0.78;
  if (overlap >= 0.3) return 0.68;
  return overlap;
}

export async function getAccountSnapshotForQuery(query: string) {
  const [accountsRaw, transactionsRaw] = await Promise.all([
    prisma.account.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }],
    }),
    prisma.transaction.findMany({
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
  ]);

  const accounts: Account[] = accountsRaw.map((account) => ({
    id: account.id,
    name: account.name,
    ownerType: account.ownerType,
    accountSubtype: account.accountSubtype,
    annualRatePercent: account.annualRatePercent,
    limitAmount: account.limitAmount,
    startingBalance: account.startingBalance,
    startingDate: account.startingDate ? account.startingDate.toISOString() : null,
    isActive: account.isActive,
  }));

  const transactions: Transaction[] = transactionsRaw.map((txn) => ({
    id: txn.id,
    date: txn.date.toISOString(),
    yearMonth: txn.yearMonth,
    description: txn.description,
    amount: txn.amount,
    type: txn.type,
    source: txn.source,
    fromAccountId: txn.fromAccountId,
    toAccountId: txn.toAccountId,
    billId: txn.billId,
    category: txn.category,
    notes: txn.notes,
  }));

  const scored = accounts
    .map((account) => ({
      account,
      score: scoreAccountMatch(query, account.name),
    }))
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (!top || top.score < 0.7) {
    return { kind: "none" as const };
  }

  const second = scored[1];
  if (top.score < 0.9 || (second && top.score - second.score < 0.1)) {
    return {
      kind: "ambiguous" as const,
      candidates: scored
        .filter((item) => item.score >= 0.7)
        .slice(0, 3)
        .map((item) => item.account.name),
    };
  }

  const balances = computeAccountBalances(accounts, transactions);
  const balance = balances.get(top.account.id) ?? top.account.startingBalance;
  const lastTxn = transactionsRaw
    .filter((txn) => txn.fromAccountId === top.account.id || txn.toAccountId === top.account.id)
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];

  const snapshot: AccountSnapshot = {
    accountId: top.account.id,
    accountName: top.account.name,
    accountSubtype: top.account.accountSubtype,
    balance,
    confidence: top.score,
    lastUpdatedAt: lastTxn ? lastTxn.date.toISOString() : null,
  };
  return { kind: "match" as const, snapshot };
}

