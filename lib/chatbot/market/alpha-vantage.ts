import type { MarketSnapshot } from "@/lib/types/chatbot";

type CacheEntry = {
  expiresAt: number;
  value: MarketSnapshot;
};

const cache = new Map<string, CacheEntry>();
const CACHE_MS = 5 * 60 * 1000;

const BASE_URL = process.env.ALPHA_VANTAGE_BASE_URL ?? "https://www.alphavantage.co/query";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchAlphaVantage<T>(params: Record<string, string>) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ALPHA_VANTAGE_API_KEY.");
  }

  const query = new URLSearchParams({ ...params, apikey: apiKey });
  const res = await fetch(`${BASE_URL}?${query.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Alpha Vantage request failed (${res.status}).`);
  }
  return (await res.json()) as T;
}

async function resolveSymbol(input: string) {
  if (/^[A-Za-z.]{1,10}$/.test(input)) return input.toUpperCase();

  type SearchResponse = {
    bestMatches?: Array<{ "1. symbol"?: string }>;
  };
  const search = await fetchAlphaVantage<SearchResponse>({
    function: "SYMBOL_SEARCH",
    keywords: input,
  });
  const symbol = search.bestMatches?.[0]?.["1. symbol"];
  if (!symbol) {
    throw new Error("No symbol match found.");
  }
  return symbol.toUpperCase();
}

export async function fetchMarketSnapshot(symbolOrKeywords: string): Promise<MarketSnapshot> {
  const key = symbolOrKeywords.trim().toUpperCase();
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt) {
    return hit.value;
  }

  const symbol = await resolveSymbol(symbolOrKeywords);

  type QuoteResponse = {
    "Global Quote"?: {
      "01. symbol"?: string;
      "05. price"?: string;
      "07. latest trading day"?: string;
      "09. change"?: string;
      "10. change percent"?: string;
    };
  };

  type OverviewResponse = {
    Name?: string;
    Sector?: string;
    MarketCapitalization?: string;
    PERatio?: string;
  };

  type DailyResponse = {
    "Time Series (Daily)"?: Record<string, { "4. close"?: string }>;
  };

  const [quote, overview, daily] = await Promise.all([
    fetchAlphaVantage<QuoteResponse>({
      function: "GLOBAL_QUOTE",
      symbol,
    }),
    fetchAlphaVantage<OverviewResponse>({
      function: "OVERVIEW",
      symbol,
    }),
    fetchAlphaVantage<DailyResponse>({
      function: "TIME_SERIES_DAILY",
      symbol,
      outputsize: "compact",
    }),
  ]);

  const rawQuote = quote["Global Quote"];
  if (!rawQuote) {
    throw new Error("Quote data unavailable.");
  }
  const price = toNumber(rawQuote["05. price"]);
  const change = toNumber(rawQuote["09. change"]);
  const latestTradingDay = rawQuote["07. latest trading day"] ?? "";
  if (price == null || change == null || !latestTradingDay) {
    throw new Error("Incomplete quote payload.");
  }

  let trend1wPercent: number | undefined;
  const series = daily["Time Series (Daily)"];
  if (series) {
    const dates = Object.keys(series).sort().reverse();
    if (dates.length > 5) {
      const latestClose = toNumber(series[dates[0]]?.["4. close"]);
      const olderClose = toNumber(series[dates[5]]?.["4. close"]);
      if (latestClose && olderClose && olderClose > 0) {
        trend1wPercent = ((latestClose - olderClose) / olderClose) * 100;
      }
    }
  }

  const snapshot: MarketSnapshot = {
    symbol: rawQuote["01. symbol"] ?? symbol,
    price,
    change,
    changePercent: rawQuote["10. change percent"] ?? `${change}`,
    latestTradingDay,
    companyName: overview.Name,
    sector: overview.Sector,
    marketCapitalization: overview.MarketCapitalization,
    peRatio: overview.PERatio,
    trend1wPercent,
  };

  cache.set(key, { value: snapshot, expiresAt: Date.now() + CACHE_MS });
  return snapshot;
}

