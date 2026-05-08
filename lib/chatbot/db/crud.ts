import { prisma } from "@/lib/db/prisma";
import type { ChatResponse } from "@/lib/types/chatbot";
import { transactionTypeSchema, transactionSourceSchema } from "@/lib/validation/schemas";

type CrudExecution =
  | { handled: false }
  | { handled: true; response: ChatResponse };

type CrudIntent =
  | "list_accounts"
  | "list_transactions"
  | "list_bills"
  | "create_transaction"
  | "update_transaction"
  | "delete_transaction"
  | "create_bill"
  | "update_bill"
  | "delete_bill"
  | "create_account"
  | "update_account"
  | "delete_account"
  | "unknown";

function parseKeyValuePairs(input: string) {
  const pairs = input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const map = new Map<string, string>();
  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.split("=");
    if (!rawKey || rest.length === 0) continue;
    map.set(rawKey.trim().toLowerCase(), rest.join("=").trim());
  }
  return map;
}

function normalizeDate(dateValue: string | undefined) {
  if (!dateValue) return new Date();
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function normalizePrompt(input: string) {
  return input
    .toLowerCase()
    .replace(/[^\w\s.$=-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(text: string, variants: string[]) {
  return variants.some((variant) => text.includes(variant));
}

/** Matches list/show all (my) accounts, what/which accounts, etc. */
export function matchesAccountListIntent(normalized: string): boolean {
  if (
    containsAny(normalized, [
      "list accounts",
      "show accounts",
      "list my accounts",
      "show my accounts",
      "what accounts do i have",
      "what are my accounts",
      "list all accounts",
      "show all accounts",
      "list every account",
      "show every account",
      "list all my accounts",
      "show all my accounts",
    ])
  ) {
    return true;
  }
  if (/(?:^|\s)(list|show)\s+(?:all\s+|every\s+)?(?:my\s+)?accounts?\b/.test(normalized)) {
    return true;
  }
  if (/\b(what|which)\s+accounts\b/.test(normalized)) {
    return true;
  }
  return false;
}

/**
 * When the user replies briefly after the assistant asked which accounts to list / to upload a statement,
 * treat as "list all accounts" so CRUD runs instead of the LLM.
 */
const ACCOUNT_LIST_FOLLOW_UP =
  /^(all of them|all|yes|yep|yeah|every account|every one|list them all|show them all|show all|everything)$/i;

export function lastAssistantWasAccountListClarification(assistantContent: string): boolean {
  const lower = assistantContent.toLowerCase();
  const askedWhichOrWhatAccounts =
    /\b(which|what)\s+accounts\b/.test(lower) ||
    /\baccounts?\s+(you'd like|you would like)\s+(listed|to list)\b/.test(lower) ||
    /\blet me know which\s+accounts\b/.test(lower);
  const askedUploadForAccounts =
    lower.includes("upload") &&
    (lower.includes("statement") || lower.includes("statements") || lower.includes("transaction"));
  const impliedNoDataUseUpload =
    /\bdon't have any\b.*\baccount\b/i.test(lower) ||
    /\bno account\b.*\bon file\b/i.test(lower) ||
    /\baccount (details|information)\b.*\bon file\b/i.test(lower);
  return askedWhichOrWhatAccounts || askedUploadForAccounts || impliedNoDataUseUpload;
}

export function shouldResolveAccountListFollowUp(
  prompt: string,
  messages: Array<{ role: string; content: string }>,
): boolean {
  const trimmed = prompt.trim();
  if (!ACCOUNT_LIST_FOLLOW_UP.test(trimmed)) return false;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant?.content) return false;
  return lastAssistantWasAccountListClarification(lastAssistant.content);
}

export function classifyCrudIntent(prompt: string): CrudIntent {
  const normalized = normalizePrompt(prompt);

  if (matchesAccountListIntent(normalized)) return "list_accounts";

  const txnList = containsAny(normalized, [
    "list transactions",
    "show transactions",
    "show recent transactions",
    "show my transactions",
    "list my transactions",
  ]);
  if (txnList) return "list_transactions";

  const billList = containsAny(normalized, ["list bills", "show bills", "list my bills", "show my bills"]);
  if (billList) return "list_bills";

  if (containsAny(normalized, ["delete transaction", "remove transaction"])) return "delete_transaction";
  if (containsAny(normalized, ["update transaction", "edit transaction", "change transaction"])) return "update_transaction";
  if (
    containsAny(normalized, [
      "add transaction",
      "add a transaction",
      "create transaction",
      "create a transaction",
      "new transaction",
    ])
  )
    return "create_transaction";

  if (containsAny(normalized, ["delete bill", "remove bill"])) return "delete_bill";
  if (containsAny(normalized, ["update bill", "edit bill", "change bill"])) return "update_bill";
  if (containsAny(normalized, ["add bill", "create bill", "new bill"])) return "create_bill";

  if (containsAny(normalized, ["delete account", "remove account"])) return "delete_account";
  if (containsAny(normalized, ["update account", "edit account", "change account"])) return "update_account";
  if (containsAny(normalized, ["add account", "create account", "new account"])) return "create_account";

  return "unknown";
}

export function extractRecentCount(prompt: string, fallback = 10) {
  const match = prompt.match(/(?:recent|last)\s+(\d+)/i) ?? prompt.match(/\b(\d+)\b/);
  const parsed = Number(match?.[1] ?? fallback);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(50, parsed)) : fallback;
}

function tryExtractId(prompt: string, entity: "transaction" | "account" | "bill") {
  const match = prompt.match(new RegExp(`${entity}\\s+(\\d+)`, "i"));
  const parsed = Number(match?.[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function tryExtractAmount(prompt: string) {
  const kv = parseKeyValuePairs(prompt);
  if (kv.get("amount")) {
    const parsed = Number(kv.get("amount"));
    if (Number.isFinite(parsed)) return parsed;
  }
  const regexes = [
    /amount\s*(?:=|to)?\s*\$?(-?\d+(?:\.\d+)?)/i,
    /\$(-?\d+(?:\.\d+)?)/,
    /\b(-?\d+\.\d{1,2})\b/,
  ];
  for (const re of regexes) {
    const match = prompt.match(re);
    const parsed = Number(match?.[1]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function tryExtractDate(prompt: string) {
  const kv = parseKeyValuePairs(prompt);
  if (kv.get("date")) return normalizeDate(kv.get("date"));
  if (/\btoday\b/i.test(prompt)) return new Date();
  const match = prompt.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (match?.[1]) return normalizeDate(match[1]);
  return null;
}

function tryExtractType(prompt: string) {
  const kv = parseKeyValuePairs(prompt);
  const raw = (kv.get("type") ?? "").toUpperCase();
  if (raw) {
    const parsed = transactionTypeSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
  }
  if (/\bincome\b/i.test(prompt)) return "INCOME" as const;
  if (/\btransfer\b/i.test(prompt)) return "TRANSFER" as const;
  if (/\bexpense\b/i.test(prompt) || /\bspent\b/i.test(prompt)) return "EXPENSE" as const;
  return null;
}

function tryExtractSource(prompt: string) {
  const kv = parseKeyValuePairs(prompt);
  const raw = (kv.get("source") ?? "").toUpperCase();
  if (raw) {
    const parsed = transactionSourceSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
  }
  return null;
}

function tryExtractDescription(prompt: string) {
  const kv = parseKeyValuePairs(prompt);
  if (kv.get("description")) return kv.get("description")!.trim();
  const match = prompt.match(
    /(?:add|create|new)\s+transaction(?:\s+for)?\s+(.+?)(?:\s+amount|\s+\$|\s+today|\s+date|\s+type|,|$)/i,
  );
  return match?.[1]?.trim() ?? null;
}

function tryExtractCategory(prompt: string) {
  const kv = parseKeyValuePairs(prompt);
  if (kv.get("category")) return kv.get("category");
  const match = prompt.match(/category\s*(?:=|to)?\s*([a-zA-Z][\w\s-]{1,40})/i);
  return match?.[1]?.trim() ?? null;
}

function tryExtractNotes(prompt: string) {
  const kv = parseKeyValuePairs(prompt);
  if (kv.get("notes")) return kv.get("notes");
  const match = prompt.match(/notes?\s*(?:=|to)?\s*(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function tryExecuteCrudPrompt(prompt: string): Promise<CrudExecution> {
  const intent = classifyCrudIntent(prompt);

  if (intent === "list_transactions") {
    const take = extractRecentCount(prompt, 10);
    const txns = await prisma.transaction.findMany({
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take,
    });
    if (txns.length === 0) {
      return { handled: true, response: { assistantText: "No transactions found in the database." } };
    }
    const preview = txns
      .map((txn) => `${txn.id}: ${txn.date.toISOString().slice(0, 10)} ${txn.description} $${txn.amount.toFixed(2)}`)
      .join("\n");
    return {
      handled: true,
      response: { assistantText: `Recent transactions:\n${preview}` },
    };
  }

  if (intent === "list_accounts") {
    const accounts = await prisma.account.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }],
    });
    if (accounts.length === 0) {
      return { handled: true, response: { assistantText: "No active accounts found." } };
    }
    const lines = accounts.map((a) => `${a.id}: ${a.name} (${a.accountSubtype})`);
    return { handled: true, response: { assistantText: `Active accounts:\n${lines.join("\n")}` } };
  }

  if (intent === "list_bills") {
    const bills = await prisma.bill.findMany({
      where: { active: true },
      orderBy: [{ name: "asc" }],
    });
    if (bills.length === 0) {
      return { handled: true, response: { assistantText: "No active bills found." } };
    }
    const lines = bills.map((bill) => `${bill.id}: ${bill.name} $${bill.defaultAmount.toFixed(2)} due day ${bill.dueDay}`);
    return { handled: true, response: { assistantText: `Active bills:\n${lines.join("\n")}` } };
  }

  if (intent === "delete_transaction") {
    const id = tryExtractId(prompt, "transaction");
    if (!id) {
      return {
        handled: true,
        response: { assistantText: "I can delete it, but I need the transaction id (e.g. `delete transaction 42`)." },
      };
    }
    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing) {
      return { handled: true, response: { assistantText: `Transaction ${id} was not found.` } };
    }
    await prisma.transaction.delete({ where: { id } });
    return { handled: true, response: { assistantText: `Deleted transaction ${id}.` } };
  }

  if (intent === "create_transaction") {
    const fields = parseKeyValuePairs(prompt);
    const description = tryExtractDescription(prompt);
    const amount = Math.abs(tryExtractAmount(prompt) ?? Number.NaN);
    if (!description || !Number.isFinite(amount) || amount <= 0) {
      return {
        handled: true,
        response: {
          assistantText:
            "To create a transaction, use: add transaction description=..., amount=..., date=YYYY-MM-DD, type=EXPENSE|INCOME|TRANSFER, fromAccountId=..., toAccountId=..., category=...",
        },
      };
    }
    const date = tryExtractDate(prompt) ?? new Date();
    const typeParsed = tryExtractType(prompt) ?? "EXPENSE";
    const sourceParsed = tryExtractSource(prompt) ?? "MANUAL";

    const created = await prisma.transaction.create({
      data: {
        date,
        yearMonth: date.toISOString().slice(0, 7),
        description,
        amount,
        type: typeParsed,
        source: sourceParsed,
        fromAccountId: fields.get("fromaccountid") ? Number(fields.get("fromaccountid")) : null,
        toAccountId: fields.get("toaccountid") ? Number(fields.get("toaccountid")) : null,
        billId: fields.get("billid") ? Number(fields.get("billid")) : null,
        category: tryExtractCategory(prompt),
        notes: tryExtractNotes(prompt),
      },
    });
    return {
      handled: true,
      response: {
        assistantText: `Created transaction ${created.id}: ${created.description} $${created.amount.toFixed(2)}.`,
      },
    };
  }

  if (intent === "update_transaction") {
    const id = tryExtractId(prompt, "transaction");
    if (!id) {
      return {
        handled: true,
        response: { assistantText: "Please include a transaction id to update (e.g. `update transaction 42 amount to 25`)." },
      };
    }
    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing) {
      return { handled: true, response: { assistantText: `Transaction ${id} was not found.` } };
    }
    const fields = parseKeyValuePairs(prompt);
    const patch: Record<string, unknown> = {};
    if (tryExtractDescription(prompt)) patch.description = tryExtractDescription(prompt);
    if (tryExtractAmount(prompt)) {
      const amount = Math.abs(tryExtractAmount(prompt) ?? 0);
      if (Number.isFinite(amount) && amount > 0) patch.amount = amount;
    }
    if (tryExtractCategory(prompt)) patch.category = tryExtractCategory(prompt);
    if (tryExtractNotes(prompt)) patch.notes = tryExtractNotes(prompt);
    if (tryExtractType(prompt)) patch.type = tryExtractType(prompt);
    if (tryExtractSource(prompt)) patch.source = tryExtractSource(prompt);
    if (tryExtractDate(prompt)) {
      const date = tryExtractDate(prompt)!;
      patch.date = date;
      patch.yearMonth = date.toISOString().slice(0, 7);
    }
    if (fields.get("fromaccountid")) patch.fromAccountId = Number(fields.get("fromaccountid"));
    if (fields.get("toaccountid")) patch.toAccountId = Number(fields.get("toaccountid"));
    if (fields.get("billid")) patch.billId = Number(fields.get("billid"));

    if (Object.keys(patch).length === 0) {
      return {
        handled: true,
        response: {
          assistantText:
            "No valid update fields found. Use: update transaction <id> amount=..., description=..., date=YYYY-MM-DD, category=..., notes=...",
        },
      };
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: patch,
    });
    return {
      handled: true,
      response: { assistantText: `Updated transaction ${updated.id}.` },
    };
  }

  if (intent === "delete_account") {
    const id = tryExtractId(prompt, "account");
    if (!id) {
      return {
        handled: true,
        response: { assistantText: "Please include account id (e.g. `delete account 10`)." },
      };
    }
    const existing = await prisma.account.findUnique({ where: { id } });
    if (!existing) {
      return { handled: true, response: { assistantText: `Account ${id} was not found.` } };
    }
    await prisma.account.delete({ where: { id } });
    return { handled: true, response: { assistantText: `Deleted account ${id}.` } };
  }

  if (intent === "delete_bill") {
    const id = tryExtractId(prompt, "bill");
    if (!id) {
      return {
        handled: true,
        response: { assistantText: "Please include bill id (e.g. `delete bill 4`)." },
      };
    }
    const existing = await prisma.bill.findUnique({ where: { id } });
    if (!existing) {
      return { handled: true, response: { assistantText: `Bill ${id} was not found.` } };
    }
    await prisma.bill.delete({ where: { id } });
    return { handled: true, response: { assistantText: `Deleted bill ${id}.` } };
  }

  return { handled: false };
}

