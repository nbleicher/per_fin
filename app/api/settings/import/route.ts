import { apiError, apiOk } from "@/lib/api/contracts";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/observability/logger";
import * as XLSX from "xlsx";

type GenericRow = Record<string, unknown>;

function normalizeDate(input: unknown): string | null {
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return input.toISOString().slice(0, 10);
  }
  if (typeof input === "number") {
    const parsed = XLSX.SSF.parse_date_code(input);
    if (!parsed) return null;
    const value = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    return value.toISOString().slice(0, 10);
  }
  if (typeof input === "string" && input.trim()) {
    const d = new Date(input);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

function pickValue(row: GenericRow, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return null;
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return apiError("VALIDATION_ERROR", "Upload a file in form field `file`.", 422);
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const existingAccounts = await prisma.account.findMany({
    select: { id: true, name: true, accountSubtype: true },
  });
  const existingTransactions = await prisma.transaction.findMany({
    select: { date: true, description: true, amount: true },
  });
  const existingKeySet = new Set(
    existingTransactions.map(
      (txn) =>
        `${txn.date.toISOString().slice(0, 10)}|${txn.description.trim().toLowerCase()}|${txn.amount.toFixed(2)}`,
    ),
  );

  let imported = 0;
  let skipped = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<GenericRow>(sheet, {
      defval: "",
      raw: true,
    });

    for (const row of rows) {
      const dateRaw = pickValue(row, ["Date", "date", "Transaction Date", "Txn Date"]);
      const descriptionRaw = pickValue(row, ["Description", "description", "Memo", "memo"]);
      const amountRaw = pickValue(row, ["Amount", "amount", "Value", "value"]);
      if (dateRaw == null || descriptionRaw == null || amountRaw == null) {
        skipped += 1;
        continue;
      }

      const dateValue = normalizeDate(dateRaw);
      const description = String(descriptionRaw).trim();
      const amountValue = Number(amountRaw);
      if (!dateValue || !description || !Number.isFinite(amountValue) || amountValue === 0) {
        skipped += 1;
        continue;
      }

      const amountAbs = Math.abs(amountValue);
      const dedupeKey = `${dateValue}|${description.toLowerCase()}|${amountAbs.toFixed(2)}`;
      if (existingKeySet.has(dedupeKey)) {
        skipped += 1;
        continue;
      }

      const accountRaw = pickValue(row, ["Account", "account"]);
      const accountName = accountRaw ? String(accountRaw).trim().toLowerCase() : "";
      const matchedAccount = existingAccounts.find((account) =>
        accountName ? account.name.toLowerCase().includes(accountName) : false,
      );

      const type = amountValue > 0 ? "INCOME" : "EXPENSE";
      await prisma.transaction.create({
        data: {
          date: new Date(`${dateValue}T00:00:00.000Z`),
          yearMonth: dateValue.slice(0, 7),
          description,
          amount: amountAbs,
          type,
          source: "IMPORT",
          fromAccountId: type === "EXPENSE" ? matchedAccount?.id ?? null : null,
          toAccountId: type === "INCOME" ? matchedAccount?.id ?? null : null,
          category: pickValue(row, ["Category", "category"])
            ? String(pickValue(row, ["Category", "category"]))
            : null,
          notes: null,
        },
      });

      existingKeySet.add(dedupeKey);
      imported += 1;
    }
  }

  logger.info("settings_import_completed", { imported, skipped, filename: file.name });

  return apiOk({
    imported,
    skipped,
    filename: file.name,
  });
}
