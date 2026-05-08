import type { ExtractionPayload } from "@/lib/types/chatbot";

export function mapExtractionToDrafts(payload: ExtractionPayload) {
  return {
    transactions: payload.applyTargets.transactions,
    accounts: payload.applyTargets.accounts,
    bills: payload.applyTargets.bills,
  };
}

