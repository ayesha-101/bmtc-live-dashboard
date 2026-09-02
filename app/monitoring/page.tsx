import { requireMonitor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DEPARTMENT_LABELS, timeAgo } from "@/lib/format";
import AppShell from "@/app/components/app-shell";
import LivePoll from "@/app/components/live-poll";

// The accountability trail: who did what, to which record, when, from which
// department. Deliberately shows NO amounts and NO margin — this is a
// security/oversight view, so the admin can read it without ever seeing
// business figures. Manager and admin only (lib/permissions.ts).
const ACTION_LABELS: Record<string, string> = {
  quotation_created: "Quotation created",
  converted_to_lpo: "Converted to LPO",
  sent_to_invoicing: "Sent to invoicing",
  flagged_lost: "Flagged lost",
  invoiced: "Invoiced",
};

const ACTION_TONE: Record<string, string> = {
  quotation_created: "quoted",
  converted_to_lpo: "converted_lpo",
  sent_to_invoicing: "pending_invoice",
  flagged_lost: "lost",
  invoiced: "invoiced",
};

const PAGE_SIZE = 200;

export default async function MonitoringPage() {
  const user = await requireMonitor();

  const [entries, total, actors] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      select: {
        id: true,
        action: true,
        note: true,
        department: true,
        createdAt: true,
        actor: { select: { fullName: true, email: true, role: true } },
        lpo: { select: { reference: true, status: true } },
      },
    }),
    prisma.auditLog.count(),
    prisma.auditLog.groupBy({ by: ["actorId"], _count: { _all: true } }),
  ]);

  const since24h = entries.filter(
    (e) => Date.now() - e.createdAt.getTime() < 24 * 60 * 60 * 1000
  ).length;

  return (
    <AppShell user={user} active="monitoring">
      <LivePoll intervalMs={4000} />
      <div className="row-between section-gap">
        <div>
          <h1>Monitoring</h1>
          <p className="muted">
            Full accountability trail — every action, who performed it, and
            exactly when. Append-only: entries can never be edited or removed
            from here. Amounts and margin are deliberately not shown.
          </p>
        </div>
        <span className="muted"><span className="live-dot" />live</span>
      </div>

      <div className="grid kpi-grid section-gap">
        <div className="card">
          <div className="kpi-label">Total recorded actions</div>
          <div className="kpi-value">{total}</div>
          <div className="kpi-sub">since the system went live</div>
        </div>
        <div className="card">
          <div className="kpi-label">Last 24 hours</div>
          <div className="kpi-value">{since24h}</div>
          <div className="kpi-sub">actions in the shown window</div>
        </div>
        <div className="card">
          <div className="kpi-label">Active contributors</div>
          <div className="kpi-value">{actors.length}</div>
          <div className="kpi-sub">accounts that have acted</div>
        </div>
        <div className="card">
          <div className="kpi-label">Showing</div>
          <div className="kpi-value">{entries.length}</div>
          <div className="kpi-sub">most recent of {total}</div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>When (exact)</th>
              <th>Ago</th>
              <th>Who</th>
              <th>Role</th>
              <th>Action</th>
              <th>Reference</th>
              <th>Department</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-state">
                  No activity recorded yet.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{e.createdAt.toLocaleString("en-GB")}</td>
                  <td className="muted">{timeAgo(e.createdAt)}</td>
                  <td>
                    {e.actor.fullName}
                    <div className="mono muted" style={{ fontSize: 11 }}>{e.actor.email}</div>
                  </td>
                  <td>{e.actor.role}</td>
                  <td>
                    <span className={`status ${ACTION_TONE[e.action] ?? "quoted"}`}>
                      {ACTION_LABELS[e.action] ?? e.action.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="mono">{e.lpo.reference}</td>
                  <td>{DEPARTMENT_LABELS[e.department]}</td>
                  <td className="muted">{e.note || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
