import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppShell from "@/app/components/app-shell";
import LivePoll from "@/app/components/live-poll";
import UnlockButton from "./unlock-button";

const ROLE_LABELS = { employee: "Employee", manager: "Manager", admin: "Admin" } as const;

// The admin's security console: account-level signals only (lockouts,
// failed attempts, first-login resets, deactivated accounts). No business
// data — the admin never sees LPOs, margin, or the dashboard.
export default async function SecurityPage() {
  const admin = await requireAdmin();
  const now = new Date();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      isActive: true,
      failedAttempts: true,
      lockedUntil: true,
      mustChangePassword: true,
      createdAt: true,
    },
    orderBy: { fullName: "asc" },
  });

  const locked = users.filter((u) => u.lockedUntil && u.lockedUntil > now);
  const failing = users.filter((u) => u.failedAttempts > 0 && !(u.lockedUntil && u.lockedUntil > now));
  const pendingReset = users.filter((u) => u.mustChangePassword && u.isActive);
  const inactive = users.filter((u) => !u.isActive);
  const admins = users.filter((u) => u.role === "admin" && u.isActive);

  return (
    <AppShell user={admin} active="security">
      <LivePoll intervalMs={5000} />
      <div className="row-between section-gap">
        <div>
          <h1>Security</h1>
          <p className="muted">Live view of account security. Lockouts and failed sign-ins update automatically.</p>
        </div>
        <span className="muted"><span className="live-dot" />live</span>
      </div>

      <div className="grid kpi-grid section-gap">
        <div className="card">
          <div className="kpi-label">Locked accounts</div>
          <div className={`kpi-value${locked.length ? " red" : " green"}`}>{locked.length}</div>
          <div className="kpi-sub">5 failed attempts → 15 min lock</div>
        </div>
        <div className="card">
          <div className="kpi-label">Failed sign-in attempts</div>
          <div className={`kpi-value${failing.length ? " amber" : " green"}`}>{failing.length}</div>
          <div className="kpi-sub">accounts with recent failures</div>
        </div>
        <div className="card">
          <div className="kpi-label">Awaiting first password</div>
          <div className={`kpi-value${pendingReset.length ? " amber" : ""}`}>{pendingReset.length}</div>
          <div className="kpi-sub">still on a one-time password</div>
        </div>
        <div className="card">
          <div className="kpi-label">Active admins</div>
          <div className={`kpi-value${admins.length > 2 ? " amber" : ""}`}>{admins.length}</div>
          <div className="kpi-sub">keep this number small</div>
        </div>
      </div>

      <div className="card section-gap">
        <h2>Lockouts &amp; failed attempts</h2>
        {locked.length + failing.length === 0 ? (
          <p className="muted">No locked accounts and no failed sign-in attempts. ✓</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Failed attempts</th>
                  <th>Locked until</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...locked, ...failing].map((u) => (
                  <tr key={u.id}>
                    <td>{u.fullName}</td>
                    <td className="mono">{u.username}</td>
                    <td>{ROLE_LABELS[u.role]}</td>
                    <td className="mono">{u.failedAttempts}</td>
                    <td className="mono">
                      {u.lockedUntil && u.lockedUntil > now ? (
                        <span className="status lost">{u.lockedUntil.toLocaleTimeString("en-AE")}</span>
                      ) : "—"}
                    </td>
                    <td><UnlockButton userId={u.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid dept-grid section-gap">
        <div className="card">
          <h2>Awaiting first password change</h2>
          {pendingReset.length === 0 ? (
            <p className="muted">Everyone has set a real password. ✓</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {pendingReset.map((u) => (
                <li key={u.id}>{u.fullName} <span className="mono muted">({u.username})</span></li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h2>Deactivated accounts</h2>
          {inactive.length === 0 ? (
            <p className="muted">None.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {inactive.map((u) => (
                <li key={u.id}>{u.fullName} <span className="mono muted">({u.username})</span></li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Hardening checklist (do once in Neon)</h2>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
          <li>
            Protect the audit trail from edits/deletes:{" "}
            <code className="mono">REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;</code>
          </li>
          <li>Enable Point-in-Time Restore (backups) in Neon → Settings.</li>
          <li>Keep <code className="mono">AUTH_SECRET</code> and <code className="mono">DATABASE_URL</code> only in Vercel environment variables.</li>
          <li>Rotate the database password if it is ever shared outside Vercel.</li>
        </ul>
      </div>
    </AppShell>
  );
}
