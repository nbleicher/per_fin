"use client";

import { useId, useMemo, useRef, useState } from "react";
import styles from "@/components/chatbot/chatbot-shell.module.css";
import { Button } from "@/components/ui/button";
import { emitChatbotDraftApply } from "@/lib/chatbot/autofill/events";
import { mapExtractionToDrafts } from "@/lib/chatbot/autofill/mappers";
import {
  toApiChatMessages,
  type ChatResponse,
  type ExtractionPayload,
  type UiChatMessage,
} from "@/lib/types/chatbot";

type ApiSuccess<T> = { ok: true; data: T };
type ApiError = { ok: false; error: { code: string; message: string } };

function normalizePrompt(prompt: string) {
  return prompt.trim();
}

function ChatBubbleIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChatbotShell() {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiChatMessage[]>([
    {
      role: "assistant",
      content:
        "Ask finance questions or upload transactions, statements, or credit docs. I can prepare draft form fills after your greenlight.",
    },
  ]);
  const [prompt, setPrompt] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastFileLabel, setLastFileLabel] = useState<string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [saveToDatabase, setSaveToDatabase] = useState(false);
  const [extraction, setExtraction] = useState<ExtractionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasDrafts = useMemo(() => {
    if (!extraction) return false;
    const t = extraction.applyTargets.transactions.length;
    const a = extraction.applyTargets.accounts.length;
    const b = extraction.applyTargets.bills.length;
    return t + a + b > 0;
  }, [extraction]);

  const onSend = async () => {
    const normalized = normalizePrompt(prompt);
    if (!normalized || loadingChat) return;
    setLoadingChat(true);
    setError(null);
    const nextMessages: UiChatMessage[] = [...messages, { role: "user", content: normalized }];
    setMessages(nextMessages);
    setPrompt("");
    try {
      const apiMessages = toApiChatMessages(nextMessages);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          prompt: normalized,
        }),
      });
      const body = (await res.json()) as ApiSuccess<ChatResponse> | ApiError;
      if (!res.ok || !body.ok) {
        setError(body.ok ? "Chat request failed." : body.error.message);
        return;
      }
      const market = body.data.marketSnapshot
        ? `\n\nMarket snapshot: ${body.data.marketSnapshot.symbol} ${body.data.marketSnapshot.price.toFixed(2)} (${body.data.marketSnapshot.changePercent})`
        : "";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `${body.data.assistantText}${market}`,
        },
      ]);
    } catch {
      setError("Unable to send chat request.");
    } finally {
      setLoadingChat(false);
    }
  };

  const onUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setLastFileLabel(file.name);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/parse-upload", {
        method: "POST",
        body: data,
      });
      const body = (await res.json()) as ApiSuccess<ExtractionPayload> | ApiError;
      if (!res.ok || !body.ok) {
        setError(body.ok ? "Upload failed." : body.error.message);
        return;
      }
      setExtraction(body.data);
      setMessages((prev) => {
        const stripped = prev.filter((m) => !("variant" in m && m.variant === "draft_preferences"));
        return [
          ...stripped,
          { role: "assistant", content: body.data.summary },
          {
            role: "assistant",
            variant: "draft_preferences",
            content: "Before applying drafts, confirm how imports should behave:",
          },
        ];
      });
    } catch {
      setError("Unable to process upload.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onEditRowField = (
    rowId: string,
    key: "date" | "description" | "amount" | "category",
    value: string,
  ) => {
    if (!extraction) return;
    setExtraction({
      ...extraction,
      rows: extraction.rows.map((row) => {
        if (row.id !== rowId) return row;
        if (key === "amount") {
          const num = Number(value);
          return { ...row, amount: Number.isFinite(num) ? num : row.amount };
        }
        return { ...row, [key]: value };
      }),
    });
  };

  const onGreenlight = async () => {
    if (!extraction) return;
    const mapped = mapExtractionToDrafts(extraction);
    emitChatbotDraftApply({
      source: "chatbot",
      batchId: `batch-${Date.now()}`,
      transactions: mapped.transactions,
      accounts: mapped.accounts,
      bills: mapped.bills,
      replaceExisting,
    });
    if (saveToDatabase) {
      try {
        const res = await fetch("/api/chat/apply-drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            replaceExisting,
            transactions: mapped.transactions,
            accounts: mapped.accounts,
            bills: mapped.bills,
          }),
        });
        const body = (await res.json()) as
          | ApiSuccess<{
              createdAccounts: number;
              updatedAccounts: number;
              createdBills: number;
              updatedBills: number;
              createdTransactions: number;
              updatedTransactions: number;
            }>
          | ApiError;
        if (!res.ok || !body.ok) {
          setError(body.ok ? "Failed to save draft batch." : body.error.message);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                `Saved to DB: ${body.data.createdTransactions} created txns, ${body.data.updatedTransactions} updated txns, ` +
                `${body.data.createdAccounts} created accounts, ${body.data.updatedAccounts} updated accounts, ` +
                `${body.data.createdBills} created bills, ${body.data.updatedBills} updated bills.`,
            },
          ]);
        }
      } catch {
        setError("Failed to save drafts to database.");
      }
    }
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          `Applied drafts: ${mapped.transactions.length} transaction(s), ` +
          `${mapped.accounts.length} account(s), ${mapped.bills.length} bill(s).`,
      },
    ]);
  };

  return (
    <div className={styles.container}>
      {open ? (
        <section className={styles.panel} aria-label="Finance assistant">
          <div className={styles.header}>
            <div className={styles.headerTitleBlock}>
              <strong className={styles.headerTitle}>Finance Assistant</strong>
              <span className={styles.headerHint}>Chat or attach files to extract drafts.</span>
            </div>
            <Button variant="ghost" size="sm" type="button" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>

          <div className={styles.scrollArea}>
            <div className={styles.transcript}>
              {messages.map((message, idx) => {
                if ("variant" in message && message.variant === "draft_preferences") {
                  return (
                    <div key={`draft-prefs-${idx}`} className={styles.turnAssistant}>
                      <div className={styles.draftPrefsCard}>
                        <p className={styles.draftPrefsIntro}>{message.content}</p>
                        <label className={styles.optionLabel}>
                          <input
                            type="checkbox"
                            checked={replaceExisting}
                            onChange={(e) => setReplaceExisting(e.target.checked)}
                          />
                          Replace existing field values when applying drafts
                        </label>
                        <label className={styles.optionLabel}>
                          <input
                            type="checkbox"
                            checked={saveToDatabase}
                            onChange={(e) => setSaveToDatabase(e.target.checked)}
                          />
                          Save to database on greenlight
                        </label>
                      </div>
                    </div>
                  );
                }
                if (message.role === "user") {
                  return (
                    <div key={`msg-${idx}`} className={styles.turnUser}>
                      <div className={styles.bubbleUser}>{message.content}</div>
                    </div>
                  );
                }
                return (
                  <div key={`msg-${idx}`} className={styles.turnAssistant}>
                    <div className={styles.bubbleAssistant}>{message.content}</div>
                  </div>
                );
              })}

              {error ? <div className={styles.errorBanner}>{error}</div> : null}

              {extraction ? (
                <div className={styles.extractionBlock}>
                  {extraction.rows.length ? (
                    <div className={styles.tableWrap}>
                      <table className={`ui-table ${styles.table}`}>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Description</th>
                            <th>Amount</th>
                            <th>Category</th>
                            <th>Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {extraction.rows.map((row) => (
                            <tr key={row.id}>
                              <td>
                                <input
                                  className={styles.input}
                                  value={row.date ?? ""}
                                  onChange={(e) => onEditRowField(row.id, "date", e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  className={styles.input}
                                  value={row.description ?? ""}
                                  onChange={(e) => onEditRowField(row.id, "description", e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  className={styles.input}
                                  type="number"
                                  step="0.01"
                                  value={row.amount ?? ""}
                                  onChange={(e) => onEditRowField(row.id, "amount", e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  className={styles.input}
                                  value={row.category ?? ""}
                                  onChange={(e) => onEditRowField(row.id, "category", e.target.value)}
                                />
                              </td>
                              <td>{Math.round(row.confidence * 100)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {extraction.warnings.length ? (
                    <div className={styles.warningText}>Warnings: {extraction.warnings.join(" | ")}</div>
                  ) : null}
                  <Button
                    variant="primary"
                    size="md"
                    type="button"
                    onClick={() => void onGreenlight()}
                    disabled={!hasDrafts}
                  >
                    Greenlight batch draft fill
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <div className={styles.composerDock}>
            <input
              ref={fileInputRef}
              id={fileInputId}
              type="file"
              accept=".csv,.xlsx,.xls,.pdf,.txt"
              className={styles.hiddenFile}
              onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
            />
            <div className={styles.composerBar}>
              <label htmlFor={fileInputId} className={styles.attachBtn} title="Attach file">
                +
              </label>
              <input
                className={`ui-input ui-input-flex ${styles.composerInput}`}
                value={prompt}
                placeholder="Ask a finance question..."
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) void onSend();
                }}
              />
              <Button
                className={styles.sendBtn}
                variant="primary"
                size="md"
                type="button"
                onClick={() => void onSend()}
                disabled={loadingChat}
              >
                {loadingChat ? "…" : "Send"}
              </Button>
            </div>
            <div className={styles.composerMeta}>
              {lastFileLabel ? <span className={styles.fileChip}>{lastFileLabel}</span> : null}
              {uploading ? <span className={styles.muted}>Processing file…</span> : null}
            </div>
            <p className={styles.disclaimer}>Assistant can make mistakes. Verify amounts before greenlighting.</p>
          </div>
        </section>
      ) : null}

      <button
        className={`${styles.launcher} ${open ? styles.launcherOpen : styles.launcherPulse}`}
        type="button"
        aria-label="Open finance assistant"
        title="Finance assistant"
        onClick={() => setOpen((prev) => !prev)}
      >
        <ChatBubbleIcon />
      </button>
    </div>
  );
}
