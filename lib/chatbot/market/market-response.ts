import type { MarketSnapshot } from "@/lib/types/chatbot";

export function describeSnapshot(snapshot: MarketSnapshot) {
  const company = snapshot.companyName ? `${snapshot.companyName} (${snapshot.symbol})` : snapshot.symbol;
  const trend =
    typeof snapshot.trend1wPercent === "number"
      ? ` 1w trend: ${snapshot.trend1wPercent >= 0 ? "+" : ""}${snapshot.trend1wPercent.toFixed(2)}%.`
      : "";
  return `${company} is at ${snapshot.price.toFixed(2)} (${snapshot.changePercent}) as of ${snapshot.latestTradingDay}.${trend}`;
}

