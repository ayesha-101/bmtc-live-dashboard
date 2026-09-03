"use client";

import { useState, useTransition } from "react";
import type { Department } from "@prisma/client";
import { saveTargetAction } from "./actions";

export default function TargetRow({
  department,
  label,
  year,
  revenueTarget,
  gpTarget,
}: {
  department: Department;
  label: string;
  year: number;
  revenueTarget: number | null;
  gpTarget: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Live so the BM can sanity-check the two figures against each other as
  // they type: GP ÷ revenue is the margin the target implies.
  const [revenue, setRevenue] = useState(revenueTarget ?? 0);
  const [gp, setGp] = useState(gpTarget ?? 0);
  const marginPct = revenue > 0 ? (gp / revenue) * 100 : 0;
  const marginOk = gp <= revenue;

  function submit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveTargetAction(department, formData);
      if (res.error) setError(res.error);
      else setSaved(true);
    });
  }

  const monthly = revenue > 0 ? revenue / 12 : 0;
  const monthlyGp = gp > 0 ? gp / 12 : 0;

  return (
    <form action={submit} className="card" style={{ marginBottom: 14 }}>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <strong>{label}</strong>
        {revenue > 0 && (
          <span
            className="mono"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: !marginOk ? "var(--red)" : marginPct > 0 ? "var(--green)" : "var(--ink-faint)",
            }}
          >
            {marginPct.toFixed(1)}% GP margin
          </span>
        )}
      </div>
      <input type="hidden" name="year" value={year} />
      <div className="form-grid">
        <div className="field">
          <label>Annual revenue target (AED)</label>
          <input
            name="revenueTarget"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={revenueTarget ?? undefined}
            placeholder="0.00"
            onChange={(e) => setRevenue(Number(e.target.value) || 0)}
          />
        </div>
        <div className="field">
          <label>Annual GP target (AED)</label>
          <input
            name="gpTarget"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={gpTarget ?? undefined}
            placeholder="0.00"
            onChange={(e) => setGp(Number(e.target.value) || 0)}
          />
        </div>
      </div>
      {monthly > 0 && (
        <div
          className="kpi-sub"
          style={{
            display: "grid", gap: 3, marginBottom: 12,
            borderTop: "1px solid var(--line)", paddingTop: 8,
          }}
        >
          <div className="row-between">
            <span>Monthly revenue (target ÷ 12)</span>
            <span className="mono">AED {monthly.toLocaleString("en-AE", { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="row-between">
            <span>Monthly GP</span>
            <span className="mono">AED {monthlyGp.toLocaleString("en-AE", { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      )}
      {!marginOk && (
        <div className="note error">The GP target is higher than the revenue target — check the figures.</div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? "Saving…" : "Save target"}
        </button>
        {saved && <span className="muted" style={{ color: "var(--green)" }}>Saved ✓</span>}
      </div>
      {error && <div className="note error" style={{ marginTop: 10, marginBottom: 0 }}>{error}</div>}
    </form>
  );
}
