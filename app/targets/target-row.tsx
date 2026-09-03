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

  function submit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveTargetAction(department, formData);
      if (res.error) setError(res.error);
      else setSaved(true);
    });
  }

  const monthly = revenueTarget ? revenueTarget / 12 : 0;

  return (
    <form action={submit} className="card" style={{ marginBottom: 14 }}>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <strong>{label}</strong>
        {monthly > 0 && (
          <span className="muted">
            monthly ≈ AED {monthly.toLocaleString("en-AE", { maximumFractionDigits: 0 })}
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
          />
        </div>
      </div>
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
