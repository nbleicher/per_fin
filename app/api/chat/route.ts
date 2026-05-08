import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/contracts";
import { getAccountSnapshotForQuery } from "@/lib/chatbot/account/snapshot";
import {
  shouldResolveAccountListFollowUp,
  tryExecuteCrudPrompt,
} from "@/lib/chatbot/db/crud";
import { fetchMarketSnapshot } from "@/lib/chatbot/market/alpha-vantage";
import { describeSnapshot } from "@/lib/chatbot/market/market-response";
import {
  extractAccountQuery,
  extractTicker,
  shouldFetchAccountBalance,
  shouldFetchMarketSnapshot,
} from "@/lib/chatbot/market/intent-router";
import type { ChatMessage, ChatResponse } from "@/lib/types/chatbot";

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1),
      }),
    )
    .default([]),
  prompt: z.string().min(1),
});

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

async function callGroq(messages: ChatMessage[]) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY.");
  }
  const model = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    throw new Error(`Groq request failed (${res.status}).`);
  }
  const body = (await res.json()) as GroqChatResponse;
  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Groq returned an empty response.");
  }
  return content;
}

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid chat payload.", 422, parsed.error.flatten());
  }

  const { messages, prompt } = parsed.data;
  let accountSnapshot: ChatResponse["accountSnapshot"];
  let marketSnapshot: ChatResponse["marketSnapshot"];
  let accountContext = "";
  let marketContext = "";

  const effectiveCrudPrompt = shouldResolveAccountListFollowUp(prompt, messages)
    ? "list all accounts"
    : prompt;
  const crudResult = await tryExecuteCrudPrompt(effectiveCrudPrompt);
  if (crudResult.handled) {
    return apiOk<ChatResponse>(crudResult.response);
  }

  if (shouldFetchAccountBalance(prompt)) {
    const accountQuery = extractAccountQuery(prompt);
    const accountResult = await getAccountSnapshotForQuery(accountQuery);
    if (accountResult.kind === "match") {
      accountSnapshot = accountResult.snapshot;
      const asOf = accountSnapshot.lastUpdatedAt
        ? new Date(accountSnapshot.lastUpdatedAt).toISOString().slice(0, 10)
        : "current records";
      const absBalance = Math.abs(accountSnapshot.balance).toFixed(2);
      const label =
        accountSnapshot.accountSubtype === "CREDIT" || accountSnapshot.accountSubtype === "LOAN"
          ? accountSnapshot.balance >= 0
            ? `owed balance $${absBalance}`
            : `credit balance -$${absBalance}`
          : `balance $${accountSnapshot.balance.toFixed(2)}`;
      return apiOk<ChatResponse>({
        assistantText: `${accountSnapshot.accountName} ${label} as of ${asOf}.`,
        accountSnapshot,
      });
    }
    if (accountResult.kind === "ambiguous") {
      return apiOk<ChatResponse>({
        assistantText: `I found multiple possible accounts: ${accountResult.candidates.join(", ")}. Which one did you mean?`,
      });
    }
    accountContext =
      "\nNo reliable account match found in current records. Ask user to confirm account name or upload recent statement.\n";
  }

  if (shouldFetchMarketSnapshot(prompt)) {
    const symbolHint = extractTicker(prompt) ?? prompt;
    try {
      marketSnapshot = await fetchMarketSnapshot(symbolHint);
      marketContext = `\nMarket data context: ${describeSnapshot(marketSnapshot)}\n`;
    } catch {
      marketContext = "\nMarket data context unavailable right now (provider or quota limit).\n";
    }
  }

  const systemMessage: ChatMessage = {
    role: "system",
    content:
      "You are a finance assistant in Noah Finance. Be concise, practical, and safe. " +
      "Do not invent market numbers. If market context is provided, use it as source of truth.",
  };
  const userMessage: ChatMessage = {
    role: "user",
    content: `${prompt}${accountContext}${marketContext}`,
  };

  try {
    const assistantText = await callGroq([systemMessage, ...messages.slice(-10), userMessage]);
    return apiOk<ChatResponse>({
      assistantText,
      accountSnapshot,
      marketSnapshot,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate chat response.";
    return apiError("CHAT_PROVIDER_ERROR", message, 502);
  }
}

