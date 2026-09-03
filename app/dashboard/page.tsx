import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildReport, isPeriodKey, PERIOD_LABELS, type PeriodKey } from "@/lib/overview";
import { DEPARTMENT_LABELS, DEPARTMENT_SHORT, formatAED, formatDate, timeAgo } from "@/lib/format";
import AppShell from "@/app/components/app-shell";
import LivePoll from "@/app/components/live-poll";
import { KpiCard, TargetBar } from "./kpi-card";

const PERIODS: PeriodKey[] = ["month", "year", "todate"];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requireManager();
  const { period: raw } = await searchParams;
  const period: PeriodKey = isPeriodKey(raw) ? raw : "month";

  const [report, recent] = await Promise.all([
    buildReport(period),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: {
        actor: { select: { fullName: true } },
        deal: { select: { reference: true, customer: true } },
      },
    }),
  ]);
  const { totals, byDepartment, comparable } = report;

  // Spell the window out, so "This Month" is never ambiguous.
  const rangeLabel =
    period === "todate"
      ? "Everything recorded so far"
      : `${formatDate(report.from)} — today`;

  return (
    <AppShell user={user} active="dashboard">
      <LivePoll />
      <div className="row-between section-gap">
        <div>
          <h1>Manager Dashboard</h1>
          <p className="muted">
            Revenue is recognised from invoices. Bookings are counted on the
            LPO date, pipeline on the quote date.
          </p>
        </div>
        <span className="muted"><span className="live-dot" />live</span>
      </div>

      {/* Period picker — the BM chooses monthly, yearly, or cumulative. */}
      <div className="row-between section-gap">
        <nav className="segmented">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/dashboard?period=${p}`}
              className={p === period ? "on" : undefined}
              aria-current={p === period ? "page" : undefined}
            >
              {PERIOD_LABELS[p]}
            </Link>
          ))}
        </nav>
        <span className="muted">{rangeLabel}</span>
      </div>

      <div className="grid kpi-grid section-gap">
        <KpiCard
          label="Revenue (invoiced)"
          value={formatAED(totals.revenue)}
          sub={comparable && totals.revenueTarget > 0
            ? `${totals.revenueAchieved.toFixed(0)}% of ${formatAED(totals.revenueTarget)}`
            : `${totals.invoiceCount} invoices`}
          tone={!comparable || totals.revenueTarget === 0 ? undefined
            : totals.revenueAchieved >= 100 ? "green" : totals.revenueAchieved >= 70 ? "amber" : "red"}
        />
        <KpiCard
          label="Gross profit"
          value={formatAED(totals.gp)}
          sub={`${totals.gpPercent.toFixed(1)}% of revenue`}
          tone={!comparable || totals.gpTarget === 0 ? undefined
            : totals.gpAchieved >= 100 ? "green" : totals.gpAchieved >= 70 ? "amber" : "red"}
        />
        <KpiCard label="Booked (LPO)" value={formatAED(totals.booked)} sub={`${totals.bookedCount} awarded`} />
        <KpiCard label="Pipeline (quoted)" value={formatAED(totals.pipeline)} sub={`${totals.pipelineCount} open quotations`} />
        <KpiCard label="Lost" value={totals.lostCount} tone={totals.lostCount > 0 ? "red" : undefined} />
      </div>

      <h2>By department — {PERIOD_LABELS[period]}</h2>
      <div className="grid dept-grid section-gap">
        {byDepartment.map((d) => (
          <div key={d.department} className="card">
            <div className="row-between" style={{ marginBottom: 12 }}>
              <strong>{DEPARTMENT_LABELS[d.department]}</strong>
              <span className="pill">{d.invoiceCount} inv</span>
            </div>
            <TargetBar label="Revenue" actual={d.revenue} target={d.revenueTarget} comparable={comparable} />
            <TargetBar label="GP" actual={d.gp} target={d.gpTarget} comparable={comparable} />
            <div className="kpi-sub" style={{ display: "grid", gap: 3, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
              <div className="row-between"><span>GP margin</span><span className="mono">{d.gpPercent.toFixed(1)}%</span></div>
              <div className="row-between"><span>Booked (LPO)</span><span className="mono">{formatAED(d.booked)}</span></div>
              <div className="row-between"><span>Pipeline</span><span className="mono">{formatAED(d.pipeline)}</span></div>
              <div className="row-between"><span>Lost</span><span className="mono">{d.lostCount}</span></div>
            </div>
          </div>
        ))}
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
                <b>{a.actor.fullName}</b>: {a.action.replace(/_/g, " ")} on{" "}
                <span className="mono">{a.deal.reference}</span>
                <span className="muted"> · {a.deal.customer}</span>
                <span className="pill" style={{ marginLeft: 8 }}>{DEPARTMENT_SHORT[a.department]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
