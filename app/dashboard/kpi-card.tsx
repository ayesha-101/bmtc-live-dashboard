import { formatAED } from "@/lib/format";

export function KpiCard({
  label, value, sub, tone,
}: { label: string; value: string | number; sub?: string; tone?: "green" | "amber" | "red" }) {
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${tone ? " " + tone : ""}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// Achievement against target: the bar is the story, the numbers back it up.
export function TargetBar({
  label, actual, target, comparable,
}: { label: string; actual: number; target: number; comparable: boolean }) {
  const pct = target > 0 ? (actual / target) * 100 : 0;
  const tone = pct >= 100 ? "var(--green)" : pct >= 70 ? "var(--amber)" : "var(--red)";
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="row-between" style={{ fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: "var(--ink-dim)" }}>{label}</span>
        <span className="mono" style={{ color: "var(--ink)" }}>
          {formatAED(actual)}
          {comparable && target > 0 && (
            <span style={{ color: "var(--ink-faint)" }}> / {formatAED(target)}</span>
          )}
        </span>
      </div>
      {comparable && target > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 7, background: "var(--panel-2)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: tone, borderRadius: 4 }} />
          </div>
          <span className="mono" style={{ fontSize: 11.5, fontWeight: 700, color: tone, minWidth: 44, textAlign: "right" }}>
            {pct.toFixed(0)}%
          </span>
        </div>
      ) : (
        <div className="muted" style={{ fontSize: 11 }}>
          {comparable ? "no target set" : "cumulative — no period target"}
        </div>
      )}
    </div>
  );
}
