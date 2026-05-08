"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Portfolio = { id: number; name: string; description: string | null };
type Holding = {
  id: number;
  portfolioId: number;
  symbol: string;
  name: string | null;
  shares: number;
  averageCost: number;
  currentPrice: number | null;
  categoryName: string | null;
};
type Trade = { id: number; portfolioId: number; symbol: string; tradeType: "BUY" | "SELL"; shares: number; price: number };
type Dividend = { id: number; portfolioId: number; symbol: string; amount: number; payDate: string };
type Category = { id: number; portfolioId: number; name: string; targetWeight: number };
type Snapshot = {
  id: number;
  portfolioId: number;
  snapshotDate: string;
  totalValue: number;
  investedAmount: number;
  unrealizedPnL: number;
  estimatedDayMove: number;
};

type ApiSuccess<T> = { ok: true; data: T };
type ApiError = { ok: false; error: { code: string; message: string } };

export function InvestmentsTab() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [portfolioName, setPortfolioName] = useState("");
  const [holdingSymbol, setHoldingSymbol] = useState("");
  const [holdingShares, setHoldingShares] = useState("");
  const [holdingCost, setHoldingCost] = useState("");
  const [holdingPrice, setHoldingPrice] = useState("");
  const [holdingCategory, setHoldingCategory] = useState("");

  const [tradeSymbol, setTradeSymbol] = useState("");
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [tradeShares, setTradeShares] = useState("");
  const [tradePrice, setTradePrice] = useState("");

  const [divSymbol, setDivSymbol] = useState("");
  const [divAmount, setDivAmount] = useState("");

  const [categoryName, setCategoryName] = useState("");
  const [categoryWeight, setCategoryWeight] = useState("");

  const fetchJson = useCallback(async <T,>(url: string) => {
    const res = await fetch(url);
    const body = (await res.json()) as ApiSuccess<T> | ApiError;
    if (!res.ok || !body.ok) throw new Error(body && !body.ok ? body.error.message : `Failed request: ${url}`);
    return body.data;
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const portfolioData = await fetchJson<Portfolio[]>("/api/portfolios?pageSize=200");
      setPortfolios(portfolioData);
      const activeId = selectedPortfolioId ?? portfolioData[0]?.id ?? null;
      setSelectedPortfolioId(activeId);

      if (activeId) {
        const [h, t, d, c, s] = await Promise.all([
          fetchJson<Holding[]>(`/api/holdings?portfolioId=${activeId}&pageSize=400`),
          fetchJson<Trade[]>(`/api/trades?portfolioId=${activeId}&pageSize=400`),
          fetchJson<Dividend[]>(`/api/dividends?portfolioId=${activeId}&pageSize=400`),
          fetchJson<Category[]>(`/api/portfolio-categories?portfolioId=${activeId}&pageSize=200`),
          fetchJson<Snapshot[]>(`/api/snapshots?portfolioId=${activeId}&pageSize=200`),
        ]);
        setHoldings(h);
        setTrades(t);
        setDividends(d);
        setCategories(c);
        setSnapshots(s);
      } else {
        setHoldings([]);
        setTrades([]);
        setDividends([]);
        setCategories([]);
        setSnapshots([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load investment data.");
    } finally {
      setLoading(false);
    }
  }, [fetchJson, selectedPortfolioId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const metrics = useMemo(() => {
    const totalValue = holdings.reduce(
      (sum, row) => sum + row.shares * (row.currentPrice ?? row.averageCost),
      0,
    );
    const investedAmount = holdings.reduce((sum, row) => sum + row.shares * row.averageCost, 0);
    const unrealizedPnL = totalValue - investedAmount;
    const estimatedDayMove = totalValue * 0.0025;
    return { totalValue, investedAmount, unrealizedPnL, estimatedDayMove };
  }, [holdings]);

  const allocationRows = useMemo(() => {
    const totalValue = metrics.totalValue || 1;
    return categories.map((category) => {
      const categoryValue = holdings
        .filter((holding) => (holding.categoryName ?? "Uncategorized") === category.name)
        .reduce(
          (sum, holding) => sum + holding.shares * (holding.currentPrice ?? holding.averageCost),
          0,
        );
      const actualWeight = (categoryValue / totalValue) * 100;
      return {
        name: category.name,
        targetWeight: category.targetWeight,
        actualWeight,
        delta: actualWeight - category.targetWeight,
      };
    });
  }, [categories, holdings, metrics.totalValue]);

  const createPortfolio = async () => {
    if (!portfolioName.trim()) return;
    const res = await fetch("/api/portfolios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: portfolioName.trim() }),
    });
    if (!res.ok) {
      setError("Failed to create portfolio.");
      return;
    }
    setPortfolioName("");
    await loadAll();
  };

  const deletePortfolio = async (id: number) => {
    const res = await fetch(`/api/portfolios/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to delete portfolio.");
      return;
    }
    if (selectedPortfolioId === id) {
      setSelectedPortfolioId(null);
    }
    await loadAll();
  };

  const createHolding = async () => {
    if (!selectedPortfolioId) return;
    const res = await fetch("/api/holdings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolioId: selectedPortfolioId,
        symbol: holdingSymbol.trim(),
        shares: Number(holdingShares),
        averageCost: Number(holdingCost),
        currentPrice: holdingPrice.trim() ? Number(holdingPrice) : null,
        categoryName: holdingCategory.trim() || null,
      }),
    });
    if (!res.ok) {
      setError("Failed to add holding.");
      return;
    }
    setHoldingSymbol("");
    setHoldingShares("");
    setHoldingCost("");
    setHoldingPrice("");
    setHoldingCategory("");
    await loadAll();
  };

  const deleteHolding = async (id: number) => {
    const res = await fetch(`/api/holdings/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to delete holding.");
      return;
    }
    await loadAll();
  };

  const createTrade = async () => {
    if (!selectedPortfolioId) return;
    const res = await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolioId: selectedPortfolioId,
        symbol: tradeSymbol.trim(),
        tradeType,
        shares: Number(tradeShares),
        price: Number(tradePrice),
        tradeDate: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      setError("Failed to add trade.");
      return;
    }
    setTradeSymbol("");
    setTradeShares("");
    setTradePrice("");
    await loadAll();
  };

  const createDividend = async () => {
    if (!selectedPortfolioId) return;
    const res = await fetch("/api/dividends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolioId: selectedPortfolioId,
        symbol: divSymbol.trim(),
        amount: Number(divAmount),
        payDate: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      setError("Failed to add dividend.");
      return;
    }
    setDivSymbol("");
    setDivAmount("");
    await loadAll();
  };

  const createCategory = async () => {
    if (!selectedPortfolioId) return;
    const res = await fetch("/api/portfolio-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolioId: selectedPortfolioId,
        name: categoryName.trim(),
        targetWeight: Number(categoryWeight),
      }),
    });
    if (!res.ok) {
      setError("Failed to add category.");
      return;
    }
    setCategoryName("");
    setCategoryWeight("");
    await loadAll();
  };

  const createSnapshot = async () => {
    if (!selectedPortfolioId) return;
    const res = await fetch("/api/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolioId: selectedPortfolioId,
        snapshotDate: new Date().toISOString(),
        totalValue: Number(metrics.totalValue.toFixed(2)),
        investedAmount: Number(metrics.investedAmount.toFixed(2)),
        unrealizedPnL: Number(metrics.unrealizedPnL.toFixed(2)),
        estimatedDayMove: Number(metrics.estimatedDayMove.toFixed(2)),
      }),
    });
    if (!res.ok) {
      setError("Failed to create snapshot.");
      return;
    }
    await loadAll();
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {loading ? <p>Loading investments...</p> : null}
      {error ? <p style={{ color: "var(--destructive)", fontSize: "0.875rem" }}>{error}</p> : null}

      <Card title="Portfolios" description="Create/select/delete portfolios.">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {portfolios.map((portfolio) => (
            <Button
              key={portfolio.id}
              type="button"
              variant={selectedPortfolioId === portfolio.id ? "outline" : "ghost"}
              size="sm"
              onClick={() => setSelectedPortfolioId(portfolio.id)}
            >
              {portfolio.name}
            </Button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="ui-input ui-input-flex"
            placeholder="New portfolio name"
            value={portfolioName}
            onChange={(e) => setPortfolioName(e.target.value)}
          />
          <Button variant="primary" size="md" type="button" onClick={() => void createPortfolio()}>
            Create
          </Button>
          {selectedPortfolioId ? (
            <Button variant="destructive" size="md" type="button" onClick={() => void deletePortfolio(selectedPortfolioId)}>
              Delete selected
            </Button>
          ) : null}
        </div>
      </Card>

      <Card title="Portfolio Metrics" description="Value, invested capital, unrealized P/L, and estimated day move.">
        <div className="ui-field-grid">
          <StateMetric label="Total Value" value={metrics.totalValue} />
          <StateMetric label="Invested" value={metrics.investedAmount} />
          <StateMetric label="Unrealized P/L" value={metrics.unrealizedPnL} />
          <StateMetric label="Est. Day Move" value={metrics.estimatedDayMove} />
        </div>
      </Card>

      <Card title="Holdings" description="Add/remove holdings.">
        <div className="ui-field-grid">
          <input className="ui-input" placeholder="Symbol" value={holdingSymbol} onChange={(e) => setHoldingSymbol(e.target.value)} />
          <input className="ui-input" placeholder="Shares" type="number" value={holdingShares} onChange={(e) => setHoldingShares(e.target.value)} />
          <input className="ui-input" placeholder="Avg cost" type="number" value={holdingCost} onChange={(e) => setHoldingCost(e.target.value)} />
          <input className="ui-input" placeholder="Current price" type="number" value={holdingPrice} onChange={(e) => setHoldingPrice(e.target.value)} />
          <input className="ui-input" placeholder="Category" value={holdingCategory} onChange={(e) => setHoldingCategory(e.target.value)} />
          <Button variant="primary" size="md" type="button" onClick={() => void createHolding()}>
            Add holding
          </Button>
        </div>
        <SimpleTable
          columns={["Symbol", "Shares", "Avg Cost", "Current", "Category", "Actions"]}
          rows={holdings.map((holding) => [
            holding.symbol,
            holding.shares.toFixed(4),
            `$${holding.averageCost.toFixed(2)}`,
            `$${(holding.currentPrice ?? holding.averageCost).toFixed(2)}`,
            holding.categoryName ?? "Uncategorized",
            <Button
              key={`holding-${holding.id}`}
              variant="destructive"
              size="sm"
              type="button"
              onClick={() => void deleteHolding(holding.id)}
            >
              Delete
            </Button>,
          ])}
        />
      </Card>

      <Card title="Trades and Dividends" description="Record trade and dividend events.">
        <div className="ui-field-grid">
          <input className="ui-input" placeholder="Trade symbol" value={tradeSymbol} onChange={(e) => setTradeSymbol(e.target.value)} />
          <select className="ui-select" value={tradeType} onChange={(e) => setTradeType(e.target.value as "BUY" | "SELL")}>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
          <input className="ui-input" placeholder="Shares" type="number" value={tradeShares} onChange={(e) => setTradeShares(e.target.value)} />
          <input className="ui-input" placeholder="Price" type="number" value={tradePrice} onChange={(e) => setTradePrice(e.target.value)} />
          <Button variant="outline" size="md" type="button" onClick={() => void createTrade()}>
            Add trade
          </Button>
          <input className="ui-input" placeholder="Dividend symbol" value={divSymbol} onChange={(e) => setDivSymbol(e.target.value)} />
          <input className="ui-input" placeholder="Dividend amount" type="number" value={divAmount} onChange={(e) => setDivAmount(e.target.value)} />
          <Button variant="outline" size="md" type="button" onClick={() => void createDividend()}>
            Add dividend
          </Button>
        </div>
        <SimpleTable
          columns={["Recent Trades", "Type", "Shares", "Price"]}
          rows={trades.slice(0, 8).map((trade) => [
            trade.symbol,
            trade.tradeType,
            trade.shares.toString(),
            `$${trade.price.toFixed(2)}`,
          ])}
        />
        <SimpleTable
          columns={["Recent Dividends", "Symbol", "Amount", "Date"]}
          rows={dividends.slice(0, 8).map((dividend) => [
            `#${dividend.id}`,
            dividend.symbol,
            `$${dividend.amount.toFixed(2)}`,
            dividend.payDate.slice(0, 10),
          ])}
        />
      </Card>

      <Card title="Category Targets vs Actual" description="Track category target weights against actual allocation.">
        <div className="ui-field-grid">
          <input
            className="ui-input"
            placeholder="Category name"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
          />
          <input
            className="ui-input"
            type="number"
            placeholder="Target %"
            value={categoryWeight}
            onChange={(e) => setCategoryWeight(e.target.value)}
          />
          <Button variant="outline" size="md" type="button" onClick={() => void createCategory()}>
            Add category
          </Button>
          <Button variant="primary" size="md" type="button" onClick={() => void createSnapshot()}>
            Create snapshot
          </Button>
        </div>
        <SimpleTable
          columns={["Category", "Target %", "Actual %", "Delta %"]}
          rows={allocationRows.map((row) => [
            row.name,
            row.targetWeight.toFixed(2),
            row.actualWeight.toFixed(2),
            row.delta.toFixed(2),
          ])}
        />
        <SimpleTable
          columns={["Snapshots", "Value", "Invested", "Unrealized", "Day Move"]}
          rows={snapshots.slice(0, 8).map((snapshot) => [
            snapshot.snapshotDate.slice(0, 10),
            `$${snapshot.totalValue.toFixed(2)}`,
            `$${snapshot.investedAmount.toFixed(2)}`,
            `$${snapshot.unrealizedPnL.toFixed(2)}`,
            `$${snapshot.estimatedDayMove.toFixed(2)}`,
          ])}
        />
      </Card>
    </div>
  );
}

function StateMetric({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 8,
        background: "var(--surface)",
        padding: "0.6rem 0.75rem",
      }}
    >
      <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>${value.toFixed(2)}</div>
    </div>
  );
}

function SimpleTable({ columns, rows }: { columns: string[]; rows: Array<Array<string | ReactNode>> }) {
  return (
    <div style={{ overflowX: "auto", marginTop: 8 }}>
      <table className="ui-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: "0.6rem", color: "var(--text-muted)" }}>
                No rows yet.
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr key={idx}>
                {row.map((value, cellIdx) => (
                  <td key={`${idx}-${cellIdx}`}>{value}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
