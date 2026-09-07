import { requireMonitor, toActor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canSeeMargin, isManager } from "@/lib/permissions";
import { formatAED, timeAgo } from "@/lib/format";
import AppShell from "@/app/components/app-shell";
import LivePoll from "@/app/components/live-poll";
import { parseMoney, pick, type Raw } from "@/lib/crm";

/**
 * The CRM feed's black box.
 *
 * Every record the CRM has sent, accepted or not, with the reason. When a
 * salesperson says "my LPO isn't on the dashboard", the answer is here —
 * and it is nearly always one of three things: the project isn't in Abu
 * Dhabi, the location wasn't recognised, or their account name doesn't
 * match the CRM's.
 *
 * Manager and admin both need this — the manager to trust the numbers, the
 * admin to keep the integration healthy — but the admin never sees business
 * figures anywhere in this system, so the customer and value columns are
 * shown to the manager only.
 */

const PAGE_SIZE = 200;

const STATUS_TONE: Record<string, string> = {
  created: "lpo_received",
  updated: "quoted",
  skipped: "enquiry",
  rejected: "lost",
};

const STATUS_LABELS: Record<string, string> = {
  created: "Added",
  updated: "Updated",
  skipped: "Skipped",
  rejected: "Rejected",
};

export default async function SyncPage() {
  const user = await requireMonitor();
  const showFigures = canSeeMargin(toActor(user)) || isManager(toActor(user));

  const [entries, counts, lastOk] = await Promise.all([
    prisma.crmSyncLog.findMany({ orderBy: { id: "desc" }, take: PAGE_SIZE }),
    prisma.crmSyncLog.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.crmSyncLog.findFirst({
      where: { status: { in: ["created", "updated"] } },
      orderBy: { id: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const total = counts.reduce((n, c) => n + c._count._all, 0);
  const by = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const needsAttention = by("rejected");

  return (
    <AppShell user={user} active="sync">
      <LivePoll intervalMs={5000} />
      <div className="row-between section-gap">
        <div>
          <h1>CRM Feed</h1>
          <p className="muted">
            Every LPO the CRM has sent, and what happened to it. The feed is
            read-only towards the CRM and accepts Abu Dhabi projects only —
            anything else is skipped and listed here with its reason.
          </p>
        </div>
        <span className="muted"><span className="live-dot" />live</span>
      </div>

      <div className="stat-grid section-gap">
        <div className="card">
          <div className="muted">Records received</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="card">
          <div className="muted">On the dashboard</div>
          <div className="stat-value">{by("created") + by("updated")}</div>
        </div>
        <div className="card">
          <div className="muted">Skipped — not Abu Dhabi</div>
          <div className="stat-value">{by("skipped")}</div>
        </div>
        <div className="card">
          <div className="muted">Need attention</div>
          <div className="stat-value" style={needsAttention ? { color: "var(--danger, #b42318)" } : undefined}>
            {needsAttention}
          </div>
        </div>
        <div className="card">
          <div className="muted">Last accepted</div>
          <div className="stat-value" style={{ fontSize: 18 }}>
            {lastOk ? timeAgo(lastOk.createdAt) : "—"}
          </div>
        </div>
      </div>

      {total === 0 && (
        <div className="card section-gap">
          <h2>Nothing received yet</h2>
          <p className="muted">
            The CRM hasn&apos;t posted anything to this system. Point its webhook
            at <code>/api/crm/lpo</code> and set <code>CRM_WEBHOOK_SECRET</code>,
            and records will appear here within seconds of being saved in the CRM.
          </p>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Status</th>
              <th>CRM id</th>
              <th>Sales person</th>
              <th>Location</th>
              {showFigures && <th>Customer</th>}
              {showFigures && <th>Value</th>}
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={showFigures ? 8 : 6} className="empty-state">No CRM activity yet.</td></tr>
            ) : (
              entries.map((e) => {
                const payload = (e.payload ?? {}) as Raw;
                const customer = pick(payload, "customer", "customer_name", "account", "account_name", "client");
                const value = parseMoney(pick(payload, "lpo_value", "value", "amount", "grand_total", "total"));
                return (
                  <tr key={e.id}>
                    <td className="mono">{timeAgo(e.createdAt)}</td>
                    <td>
                      <span className={`status ${STATUS_TONE[e.status] ?? "enquiry"}`}>
                        {STATUS_LABELS[e.status] ?? e.status}
                      </span>
                    </td>
                    <td className="mono">{e.externalId || "—"}</td>
                    <td>{e.salesPerson || "—"}</td>
                    <td>{e.location || "—"}</td>
                    {showFigures && <td>{customer || "—"}</td>}
                    {showFigures && <td className="mono">{value === null ? "—" : formatAED(value)}</td>}
                    <td className="muted" style={{ maxWidth: 280 }}>{e.reason ?? "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
