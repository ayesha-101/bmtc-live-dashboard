import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeOverview } from "@/lib/overview";
import { DEPARTMENT_LABELS, formatAED, timeAgo } from "@/lib/format";
import AppShell from "@/app/components/app-shell";
import LivePoll from "@/app/components/live-poll";
import KpiCard from "./kpi-card";

export default async function DashboardPage() {
  const user = await requireManager();

  const [overview, recent] = await Promise.all([
    computeOverview(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        actor: { select: { fullName: true } },
        lpo: { select: { reference: true } },
      },
    }),
  ]);
  const { totals, byDepartment } = overview;

  return (
    <AppShell user={user} active="dashboard">
      <LivePoll />
      <div className="row-between section-gap">
        <div>
          <h1>Manager Dashboard</h1>
          <p className="muted">Company-wide totals, per-department performance, and live activity.</p>
        </div>
        <span className="muted"><span className="live-dot" />live</span>
      </div>

      <div className="grid kpi-grid section-gap">
        <KpiCard label="Total sales (LPO)" value={formatAED(totals.sales)} sub={`${totals.lpos} LPOs`} tone="green" />
        <KpiCard label="Total margin" value={formatAED(totals.margin)} sub="managers only" tone="green" />
        <KpiCard label="Invoiced" value={totals.invoiced} sub={`${totals.pending} awaiting invoice`} tone={totals.pending > 0 ? "amber" : "green"} />
        <KpiCard label="Open quoted value" value={formatAED(totals.quoted)} sub="not yet converted" />
        <KpiCard label="Lost" value={totals.lost} tone={totals.lost > 0 ? "red" : undefined} />
      </div>

      <h2>By department</h2>
      <div className="grid dept-grid section-gap">
        {byDepartment.map((s) => {
          return (
            <div key={s.department} className="card">
              <div className="row-between" style={{ marginBottom: 10 }}>
                <strong>{DEPARTMENT_LABELS[s.department]}</strong>
                <span className="pill">{s.lpos} LPO{s.lpos === 1 ? "" : "s"}</span>
              </div>
              <div className="kpi-sub" style={{ display: "grid", gap: 4 }}>
                <div className="row-between"><span>Sales</span><span className="mono">{formatAED(s.sales)}</span></div>
                <div className="row-between"><span>Margin</span><span className="mono">{formatAED(s.margin)}</span></div>
                <div className="row-between"><span>Invoiced</span><span className="mono">{s.invoiced}</span></div>
                <div className="row-between"><span>Pending invoice</span><span className="mono">{s.pending}</span></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2>Recent activity</h2>
        {recent.length === 0 ? (
          <p className="muted">No activity yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {recent.map((a) => (
              <div key={a.id} style={{ fontSize: 12.5 }}>
                <span className="muted" title={a.createdAt.toLocaleString()}>{timeAgo(a.createdAt)}</span>
                {" — "}
                <b>{a.actor.fullName}</b>: {a.action.replace(/_/g, " ")}
                {" on "}
                <span className="mono">{a.lpo.reference}</span>
                <span className="pill" style={{ marginLeft: 8 }}>{DEPARTMENT_LABELS[a.department]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
