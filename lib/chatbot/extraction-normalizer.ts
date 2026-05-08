import type {
  ExtractionPayload,
  ExtractionRow,
  ExtractionSuggestion,
  SuggestedTransactionDraft,
} from "@/lib/types/chatbot";

function deriveDocumentType(filename: string): ExtractionPayload["documentType"] {
  const lower = filename.toLowerCase();
  if (lower.includes("credit")) return "creditReport";
  if (lower.includes("statement")) return "bankStatement";
  return "transactions";
}

function toSuggestionRows(rows: ExtractionRow[]) {
  const suggestions: ExtractionSuggestion[] = [];
  for (const row of rows) {
    const rowHints: Array<{ field: string; value: string | number | null }> = [
      { field: "date", value: row.date ?? null },
      { field: "description", value: row.description ?? null },
      { field: "amount", value: row.amount ?? null },
      { field: "category", value: row.category ?? null },
    ];
    rowHints.forEach((hint) => {
      suggestions.push({
        id: `${row.id}-${hint.field}`,
        field: hint.field,
        value: hint.value,
        confidence: row.confidence,
        needsReview: row.needsReview,
      });
    });
  }
  return suggestions;
}

function rowsToTransactionDrafts(rows: ExtractionRow[]): SuggestedTransactionDraft[] {
  return rows.map((row) => ({
    date: row.date ? new Date(`${row.date}T00:00:00.000Z`).toISOString() : undefined,
    description: row.description,
    amount: row.amount,
    type: row.type,
    source: "IMPORT",
    fromAccountId: row.fromAccountId ?? null,
    toAccountId: row.toAccountId ?? null,
    billId: row.billId ?? null,
    category: row.category ?? null,
    notes: row.notes ?? null,
  }));
}

export function buildExtractionPayload(filename: string, rows: ExtractionRow[], warnings: string[]): ExtractionPayload {
  const documentType = deriveDocumentType(filename);
  const avgConfidence =
    rows.length > 0
      ? rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length
      : 0;
  const summary =
    rows.length > 0
      ? `Extracted ${rows.length} row(s) from ${filename} with avg confidence ${Math.round(avgConfidence * 100)}%.`
      : `No rows extracted from ${filename}.`;

  return {
    documentType,
    summary,
    suggestions: toSuggestionRows(rows),
    rows,
    warnings,
    applyTargets: {
      transactions: rowsToTransactionDrafts(rows),
      accounts: [],
      bills: [],
    },
  };
}

