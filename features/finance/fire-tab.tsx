"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type FireSettings = {
  currentAge: number;
  projectedAnnualIncome: number;
  annualSpending: number;
  expectedReturnPct: number;
  inflationPct: number;
  swrPct: number;
  contributionOverride: number | null;
};

type FirePoint = {
  yearOffset: number;
  age: number;
  projectedNetWorth: number;
  fireTarget: number;
  progressPct: number;
};

type ProjectionResult = {
  yearsToFire: number;
  fireAge: number;
  progressPct: number;
  points: FirePoint[];
};

type ApiSuccess<T> = { ok: true; data: T };
type ApiError = { ok: false; error: { code: string; message: string } };

const defaultSettings: FireSettings = {
  currentAge: 30,
  projectedAnnualIncome: 120000,
  annualSpending: 60000,
  expectedReturnPct: 7,
  inflationPct: 2.5,
  swrPct: 4,
  contributionOverride: null,
};

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

export function FireTab() {
  const [settings, setSettings] = useState<FireSettings>(defaultSettings);
  const [projection, setProjection] = useState<ProjectionResult | null>(null);
  const [currentNetWorth, setCurrentNetWorth] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const annualCashFlowSavings = useMemo(
    () => roundMoney(settings.projectedAnnualIncome - settings.annualSpending),
    [settings.projectedAnnualIncome, settings.annualSpending],
  );

  const savingsRateDisplay = useMemo(() => {
    const income = settings.projectedAnnualIncome;
    if (!(income > 0)) return null;
    return roundMoney(((income - settings.annualSpending) / income) * 100);
  }, [settings.projectedAnnualIncome, settings.annualSpending]);

  const effectiveAnnualContribution = useMemo(() => {
    if (typeof settings.contributionOverride === "number") {
      return settings.contributionOverride;
    }
    return Math.max(0, annualCashFlowSavings);
  }, [settings.contributionOverride, annualCashFlowSavings]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settingsRes = await fetch("/api/fire-settings");
      const settingsBody = (await settingsRes.json()) as ApiSuccess<FireSettings> | ApiError;
      if (!settingsRes.ok || !settingsBody.ok) {
        throw new Error("Failed to load FIRE settings.");
      }
      setSettings({ ...defaultSettings, ...settingsBody.data });

      const snapshotsRes = await fetch("/api/snapshots?pageSize=1");
      const snapshotsBody = (await snapshotsRes.json()) as
        | ApiSuccess<Array<{ totalValue: number }>>
        | ApiError;
      if (snapshotsRes.ok && snapshotsBody.ok && snapshotsBody.data.length > 0) {
        setCurrentNetWorth(String(snapshotsBody.data[0].totalValue.toFixed(2)));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load FIRE tab.");
    } finally {
      setLoading(false);
    }
  }, []);

  const computeProjection = useCallback(async () => {
    setError(null);
    const payload = {
      settings,
      currentNetWorth: Number(currentNetWorth),
    };
    const res = await fetch("/api/fire-settings/projection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => null)) as ApiSuccess<ProjectionResult> | ApiError | null;
    if (!res.ok || !body?.ok) {
      setError(body && !body.ok ? body.error.message : "Failed to compute projection.");
      return;
    }
    setProjection(body.data);
  }, [currentNetWorth, settings]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loading) {
      void computeProjection();
    }
  }, [computeProjection, loading]);

  const saveSettings = async () => {
    setError(null);
    const res = await fetch("/api/fire-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const body = (await res.json().catch(() => null)) as ApiSuccess<FireSettings> | ApiError | null;
    if (!res.ok || !body?.ok) {
      setError(body && !body.ok ? body.error.message : "Failed to save FIRE settings.");
      return;
    }
    await computeProjection();
  };

  const timelinePreview = useMemo(() => projection?.points.slice(0, 10) ?? [], [projection]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <Card title="FIRE Assumptions" description="Edit and save assumptions used by the projection engine.">
        {loading ? <p>Loading FIRE settings...</p> : null}
        {error ? <p style={{ color: "var(--destructive)", fontSize: "0.875rem" }}>{error}</p> : null}
        <div className="ui-field-grid">
          <label className="ui-label">
            Current age
            <input
              className="ui-input"
              type="number"
              value={settings.currentAge}
              onChange={(e) => setSettings((prev) => ({ ...prev, currentAge: Number(e.target.value) }))}
            />
          </label>
          <label className="ui-label">
            Projected annual income
            <input
              className="ui-input"
              type="number"
              step="0.01"
              min={0}
              value={settings.projectedAnnualIncome}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, projectedAnnualIncome: Number(e.target.value) }))
              }
            />
          </label>
          <label className="ui-label">
            Annual expenses
            <input
              className="ui-input"
              type="number"
              step="0.01"
              min={0}
              value={settings.annualSpending}
              onChange={(e) => setSettings((prev) => ({ ...prev, annualSpending: Number(e.target.value) }))}
            />
          </label>
          <label className="ui-label">
            Expected return %
            <input
              className="ui-input"
              type="number"
              step="0.01"
              value={settings.expectedReturnPct}
              onChange={(e) => setSettings((prev) => ({ ...prev, expectedReturnPct: Number(e.target.value) }))}
            />
          </label>
          <label className="ui-label">
            Inflation %
            <input
              className="ui-input"
              type="number"
              step="0.01"
              value={settings.inflationPct}
              onChange={(e) => setSettings((prev) => ({ ...prev, inflationPct: Number(e.target.value) }))}
            />
          </label>
          <label className="ui-label">
            SWR %
            <input
              className="ui-input"
              type="number"
              step="0.01"
              value={settings.swrPct}
              onChange={(e) => setSettings((prev) => ({ ...prev, swrPct: Number(e.target.value) }))}
            />
          </label>
          <label className="ui-label">
            Contribution override (optional)
            <input
              className="ui-input"
              type="number"
              step="0.01"
              min={0}
              value={settings.contributionOverride ?? ""}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  contributionOverride: e.target.value.trim() ? Number(e.target.value) : null,
                }))
              }
            />
          </label>
          <label className="ui-label">
            Current net worth
            <input
              className="ui-input"
              type="number"
              step="0.01"
              min={0}
              value={currentNetWorth}
              onChange={(e) => setCurrentNetWorth(e.target.value)}
            />
          </label>
        </div>
        <div
          style={{
            marginTop: 10,
            padding: "0.75rem 0.85rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--line)",
            background: "var(--surface-muted)",
            display: "grid",
            gap: 6,
            fontSize: "0.875rem",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem 1.25rem", alignItems: "baseline" }}>
            <span style={{ color: "var(--text-muted)" }}>Annual savings (income − expenses)</span>
            <strong>
              {annualCashFlowSavings < 0 ? (
                <span style={{ color: "var(--destructive)" }}>−${Math.abs(annualCashFlowSavings).toFixed(2)}</span>
              ) : (
                `$${annualCashFlowSavings.toFixed(2)}`
              )}
            </strong>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem 1.25rem", alignItems: "baseline" }}>
            <span style={{ color: "var(--text-muted)" }}>Savings rate</span>
            <strong>
              {savingsRateDisplay == null ? "—" : `${savingsRateDisplay.toFixed(1)}%`}
            </strong>
          </div>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.8125rem" }}>
            Projection uses{" "}
            {typeof settings.contributionOverride === "number" ? (
              <>
                override <strong>${settings.contributionOverride.toFixed(2)}</strong>/yr
              </>
            ) : (
              <>
                <strong>${effectiveAnnualContribution.toFixed(2)}</strong>/yr contributed (
                {annualCashFlowSavings < 0 ? "0 when expenses exceed income" : "from income − expenses"})
              </>
            )}
            .
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <Button variant="primary" size="md" type="button" onClick={() => void saveSettings()}>
            Save assumptions
          </Button>
          <Button variant="outline" size="md" type="button" onClick={() => void computeProjection()}>
            Recalculate
          </Button>
        </div>
      </Card>

      <Card title="FIRE Metrics" description="Projection output from current assumptions.">
        {!projection ? (
          <p style={{ color: "var(--text-muted)" }}>No projection yet.</p>
        ) : (
          <div className="ui-field-grid">
            <Metric label="Years to FIRE" value={projection.yearsToFire.toString()} />
            <Metric label="FIRE Age" value={projection.fireAge.toString()} />
            <Metric label="Progress" value={`${projection.progressPct.toFixed(2)}%`} />
            <Metric
              label="Annual contribution (projection)"
              value={`$${effectiveAnnualContribution.toFixed(2)}`}
            />
            <Metric
              label="Savings rate"
              value={savingsRateDisplay == null ? "—" : `${savingsRateDisplay.toFixed(1)}%`}
            />
          </div>
        )}
      </Card>

      <Card title="Projection Timeline (Preview)" description="First 10 yearly points from projection output.">
        <div style={{ overflowX: "auto" }}>
          <table className="ui-table">
            <thead>
              <tr>
                <th>Year +</th>
                <th>Age</th>
                <th className="numeric">Projected Net Worth</th>
                <th className="numeric">FIRE Target</th>
                <th className="numeric">Progress %</th>
              </tr>
            </thead>
            <tbody>
              {timelinePreview.map((point) => (
                <tr key={point.yearOffset}>
                  <td>{point.yearOffset}</td>
                  <td>{point.age}</td>
                  <td className="numeric">${point.projectedNetWorth.toFixed(2)}</td>
                  <td className="numeric">${point.fireTarget.toFixed(2)}</td>
                  <td className="numeric">{point.progressPct.toFixed(2)}%</td>
                </tr>
              ))}
              {timelinePreview.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "0.6rem", color: "var(--text-muted)" }}>
                    No timeline points yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
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
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}
