/** Plain role + content — used by `/api/chat` and Groq (no UI-only variants). */
export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

/** Display-only assistant rows (not sent to the LLM). */
export type UiChatMessage =
  | ChatMessage
  | {
      role: "assistant";
      variant: "draft_preferences";
      content: string;
    };

export function toApiChatMessages(ui: UiChatMessage[]): ChatMessage[] {
  return ui.filter((m): m is ChatMessage => !("variant" in m));
}

export type SuggestedTransactionDraft = {
  date?: string;
  description?: string;
  amount?: number;
  type?: "INCOME" | "EXPENSE" | "TRANSFER";
  source?: "MANUAL" | "IMPORT" | "ALLOCATION" | "BILL_PAYMENT";
  fromAccountId?: number | null;
  toAccountId?: number | null;
  billId?: number | null;
  category?: string | null;
  notes?: string | null;
};

export type SuggestedAccountDraft = {
  name?: string;
  ownerType?: "PERSONAL" | "BUSINESS";
  accountSubtype?: "CHECKING" | "SAVINGS" | "CREDIT" | "LOAN" | "INVESTMENT";
  annualRatePercent?: number | null;
};

export type SuggestedBillDraft = {
  name?: string;
  defaultAmount?: number;
  dueDay?: number;
  defaultFromAccountId?: number | null;
};

export type ExtractionSuggestion = {
  id: string;
  field: string;
  value: string | number | null;
  confidence: number;
  needsReview: boolean;
  rowIndex?: number;
};

export type ExtractionRow = {
  id: string;
  date?: string;
  description?: string;
  amount?: number;
  type?: "INCOME" | "EXPENSE" | "TRANSFER";
  category?: string | null;
  notes?: string | null;
  fromAccountId?: number | null;
  toAccountId?: number | null;
  billId?: number | null;
  confidence: number;
  needsReview: boolean;
};

export type ExtractionPayload = {
  documentType: "transactions" | "bankStatement" | "creditReport";
  summary: string;
  suggestions: ExtractionSuggestion[];
  rows: ExtractionRow[];
  warnings: string[];
  applyTargets: {
    transactions: SuggestedTransactionDraft[];
    accounts: SuggestedAccountDraft[];
    bills: SuggestedBillDraft[];
  };
};

export type MarketSnapshot = {
  symbol: string;
  price: number;
  change: number;
  changePercent: string;
  latestTradingDay: string;
  companyName?: string;
  sector?: string;
  marketCapitalization?: string;
  peRatio?: string;
  trend1wPercent?: number;
};

export type AccountSnapshot = {
  accountId: number;
  accountName: string;
  accountSubtype: "CHECKING" | "SAVINGS" | "CREDIT" | "LOAN" | "INVESTMENT";
  balance: number;
  confidence: number;
  lastUpdatedAt: string | null;
  ambiguityCandidates?: string[];
};

export type ChatResponse = {
  assistantText: string;
  marketSnapshot?: MarketSnapshot;
  accountSnapshot?: AccountSnapshot;
};
