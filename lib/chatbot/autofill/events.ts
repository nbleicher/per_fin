import type {
  SuggestedAccountDraft,
  SuggestedBillDraft,
  SuggestedTransactionDraft,
} from "@/lib/types/chatbot";

export const CHATBOT_DRAFT_APPLY_EVENT = "chatbot:draft-apply";

export type ChatbotDraftApplyDetail = {
  source: "chatbot";
  batchId: string;
  transactions: SuggestedTransactionDraft[];
  accounts: SuggestedAccountDraft[];
  bills: SuggestedBillDraft[];
  replaceExisting: boolean;
};

export function emitChatbotDraftApply(detail: ChatbotDraftApplyDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ChatbotDraftApplyDetail>(CHATBOT_DRAFT_APPLY_EVENT, {
      detail,
    }),
  );
}

