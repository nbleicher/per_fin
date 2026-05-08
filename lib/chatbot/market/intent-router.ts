const MARKET_KEYWORDS = [
  "stock",
  "ticker",
  "quote",
  "market",
  "price",
  "shares",
  "how is",
  "performance",
  "company overview",
];

const BALANCE_KEYWORDS = [
  "balance",
  "how much do i owe",
  "how much is on",
  "what is my",
  "card balance",
  "account balance",
];

function hasMarketKeyword(input: string) {
  const lower = input.toLowerCase();
  return MARKET_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function hasBalanceKeyword(input: string) {
  const lower = input.toLowerCase();
  return BALANCE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export function extractTicker(input: string) {
  const explicit = input.match(/\$([A-Za-z.]{1,10})/);
  if (explicit) return explicit[1].toUpperCase();
  const byWord = input.match(/\b([A-Z]{1,5})(?:\b|$)/);
  if (byWord) return byWord[1];
  return null;
}

export function shouldFetchMarketSnapshot(input: string) {
  return hasMarketKeyword(input);
}

export function shouldFetchAccountBalance(input: string) {
  return hasBalanceKeyword(input);
}

export function extractAccountQuery(input: string) {
  const lower = input.toLowerCase().trim();
  const myBalanceMatch = lower.match(/my\s+(.+?)\s+balance/);
  if (myBalanceMatch?.[1]) return myBalanceMatch[1].trim();
  const onMatch = lower.match(/balance\s+(?:on|for)\s+(.+)/);
  if (onMatch?.[1]) return onMatch[1].trim();
  return lower;
}

