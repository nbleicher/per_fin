import * as XLSX from "xlsx";
import type { ExtractionRow } from "@/lib/types/chatbot";

type AccountRef = {
  id: number;
  name: string;
};

type GenericRow = Record<string, unknown>;

function pickValue(row: GenericRow, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return null;
}

function normalizeDate(input: unknown): string | undefined {
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return input.toISOString().slice(0, 10);
  }
  if (typeof input === "number") {
    const parsed = XLSX.SSF.parse_date_code(input);
    if (!parsed) return undefined;
    const value = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    return value.toISOString().slice(0, 10);
  }
  if (typeof input === "string" && input.trim()) {
    const d = new Date(input);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }
  return undefined;
}

function parseType(raw: unknown): "INCOME" | "EXPENSE" | "TRANSFER" | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim().toUpperCase();
  if (value.includes("INCOME")) return "INCOME";
  if (value.includes("TRANSFER")) return "TRANSFER";
  if (value.includes("EXPENSE") || value.includes("DEBIT")) return "EXPENSE";
  if (value.includes("CREDIT")) return "INCOME";
  return undefined;
}

function rowConfidence(row: ExtractionRow) {
  let confidence = 0.4;
  if (row.date) confidence += 0.2;
  if (row.description) confidence += 0.2;
  if (typeof row.amount === "number" && Number.isFinite(row.amount)) confidence += 0.2;
  if (row.category) confidence += 0.05;
  return Math.max(0, Math.min(1, confidence));
}

function mapAccountId(raw: unknown, accounts: AccountRef[]) {
  if (!raw || typeof raw !== "string") return undefined;
  const lower = raw.trim().toLowerCase();
  const match = accounts.find((account) => account.name.toLowerCase().includes(lower));
  return match?.id;
}

function parseSpreadsheetRows(arrayBuffer: ArrayBuffer, accounts: AccountRef[]) {
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const rows: ExtractionRow[] = [];
  const warnings: string[] = [];
  let rowCounter = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const values = XLSX.utils.sheet_to_json<GenericRow>(sheet, {
      defval: "",
      raw: true,
    });

    for (const value of values) {
      const dateRaw = pickValue(value, ["Date", "date", "Transaction Date", "Txn Date", "posted_date"]);
      const descRaw = pickValue(value, ["Description", "description", "Memo", "memo", "merchant"]);
      const amountRaw = pickValue(value, ["Amount", "amount", "Value", "value"]);
      const typeRaw = pickValue(value, ["Type", "type", "Direction", "direction"]);
      const categoryRaw = pickValue(value, ["Category", "category"]);
      const notesRaw = pickValue(value, ["Notes", "notes"]);
      const accountRaw = pickValue(value, ["Account", "account", "From Account"]);

      const parsedAmount = Number(amountRaw);
      if (!descRaw || !Number.isFinite(parsedAmount) || parsedAmount === 0) {
        warnings.push(`Skipped row in ${sheetName}: missing description or amount.`);
        continue;
      }

      rowCounter += 1;
      const row: ExtractionRow = {
        id: `row-${rowCounter}`,
        date: normalizeDate(dateRaw),
        description: String(descRaw).trim(),
        amount: Math.abs(parsedAmount),
        type: parseType(typeRaw) ?? (parsedAmount < 0 ? "EXPENSE" : "INCOME"),
        category: categoryRaw ? String(categoryRaw).trim() : null,
        notes: notesRaw ? String(notesRaw).trim() : null,
        fromAccountId: parsedAmount < 0 ? (mapAccountId(accountRaw, accounts) ?? null) : null,
        toAccountId: parsedAmount > 0 ? (mapAccountId(accountRaw, accounts) ?? null) : null,
        confidence: 0,
        needsReview: false,
      };
      row.confidence = rowConfidence(row);
      row.needsReview = row.confidence < 0.75;
      rows.push(row);
    }
  }

  return { rows, warnings };
}

function parseTextRows(text: string) {
  const rows: ExtractionRow[] = [];
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let rowCounter = 0;
  const transactionPattern =
    /(?:(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\s+)?(.+?)\s+(-?\$?\d+(?:\.\d{2})?)$/;

  for (const line of lines) {
    const match = line.match(transactionPattern);
    if (!match) continue;
    rowCounter += 1;
    const parsedAmount = Number(String(match[3]).replace("$", ""));
    if (!Number.isFinite(parsedAmount)) {
      warnings.push(`Skipped line with unparsable amount: ${line.slice(0, 80)}`);
      continue;
    }
    const row: ExtractionRow = {
      id: `row-${rowCounter}`,
      date: normalizeDate(match[1]),
      description: match[2].trim(),
      amount: Math.abs(parsedAmount),
      type: parsedAmount < 0 ? "EXPENSE" : "INCOME",
      confidence: 0.65,
      needsReview: true,
      category: null,
      notes: null,
      fromAccountId: null,
      toAccountId: null,
      billId: null,
    };
    rows.push(row);
  }

  if (rows.length === 0) {
    warnings.push("No transaction-like lines were confidently extracted from the text document.");
  }

  return { rows, warnings };
}

export async function parseDocument(file: File, accounts: AccountRef[]) {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  if (name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls") || mime.includes("sheet")) {
    return parseSpreadsheetRows(arrayBuffer, accounts);
  }

  if (name.endsWith(".txt") || mime.startsWith("text/")) {
    const text = new TextDecoder().decode(arrayBuffer);
    return parseTextRows(text);
  }

  if (name.endsWith(".pdf") || mime.includes("pdf")) {
    // Lightweight PDF fallback: decode extractable text segments without persisting file bytes.
    const text = new TextDecoder("utf-8", { fatal: false }).decode(arrayBuffer);
    return parseTextRows(text);
  }

  return {
    rows: [] as ExtractionRow[],
    warnings: [`Unsupported file type: ${file.name}`],
  };
}

