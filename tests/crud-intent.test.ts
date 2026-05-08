import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyCrudIntent,
  extractRecentCount,
  matchesAccountListIntent,
  lastAssistantWasAccountListClarification,
  shouldResolveAccountListFollowUp,
} from "@/lib/chatbot/db/crud";

function normalizePrompt(input: string) {
  return input
    .toLowerCase()
    .replace(/[^\w\s.$=-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

test("classifies natural-language account list prompts", () => {
  assert.equal(classifyCrudIntent("list my accounts"), "list_accounts");
  assert.equal(classifyCrudIntent("what accounts do i have"), "list_accounts");
  assert.equal(classifyCrudIntent("list all accounts"), "list_accounts");
  assert.equal(classifyCrudIntent("show all my accounts"), "list_accounts");
});

test("matchesAccountListIntent covers list all / show all phrasing", () => {
  assert.equal(matchesAccountListIntent(normalizePrompt("list all accounts")), true);
  assert.equal(matchesAccountListIntent(normalizePrompt("show every account")), true);
});

test("follow-up all of them resolves when assistant asked for account clarification", () => {
  const assistantSaysWhichAccounts =
    "Could you let me know which accounts you'd like listed (e.g., checking, savings)?";
  assert.equal(lastAssistantWasAccountListClarification(assistantSaysWhichAccounts), true);
  assert.equal(
    shouldResolveAccountListFollowUp("all of them", [
      { role: "user", content: "list all accounts" },
      { role: "assistant", content: assistantSaysWhichAccounts },
    ]),
    true,
  );
  assert.equal(
    shouldResolveAccountListFollowUp("yes", [{ role: "assistant", content: "Random reply." }]),
    false,
  );
});

test("classifies natural-language transaction prompts", () => {
  assert.equal(classifyCrudIntent("add a transaction for coffee $4.50 today"), "create_transaction");
  assert.equal(classifyCrudIntent("change transaction 12 amount to 25"), "update_transaction");
  assert.equal(classifyCrudIntent("remove transaction 12"), "delete_transaction");
});

test("classifies bill and account delete prompts", () => {
  assert.equal(classifyCrudIntent("delete bill 2"), "delete_bill");
  assert.equal(classifyCrudIntent("remove account 5"), "delete_account");
});

test("extractRecentCount handles recent count phrases and boundaries", () => {
  assert.equal(extractRecentCount("show recent transactions 5"), 5);
  assert.equal(extractRecentCount("show transactions 200"), 50);
  assert.equal(extractRecentCount("show transactions"), 10);
  assert.equal(extractRecentCount("last 0 transactions"), 1);
});

