import { redirect } from "next/navigation";
import { requireReadyUser, toActor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canCreateLpo, canSeeMargin, isManager, lpoListScope } from "@/lib/permissions";
import { DEPARTMENT_LABELS, STATUS_LABELS, formatAED } from "@/lib/format";
import AppShell from "@/app/components/app-shell";
import LivePoll from "@/app/components/live-poll";
import NewLpoForm from "./new-lpo-form";
import LpoRowActions from "./lpo-row-actions";

export default async function LposPage() {
  const user = await requireReadyUser();
  const actor = toActor(user);

  // Sales Admin's home is the invoices queue, not this page.
  if (!canCreateLpo(actor) && !isManager(actor)) redirect("/invoices");

  const showMargin = canSeeMargin(actor);
  const showOwner = isManager(actor);
  const showActions = canCreateLpo(actor);

  const lpos = await prisma.lpo.findMany({
    where: lpoListScope(actor),
    include: { createdBy: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <AppShell user={user} active="lpos">
      <LivePoll />
      <div className="row-between section-gap">
        <div>
          <h1>{isManager(actor) ? "All LPOs" : "My LPOs"}</h1>
          <p className="muted">
            {isManager(actor)
              ? "Every quotation and LPO across all departments."
              : "Quotations and LPOs you have created. Every change is logged."}
          </p>
        </div>
        <span className="muted"><span className="live-dot" />live</span>
      </div>

      {canCreateLpo(actor) && (
        <div className="card section-gap">
          <h2>New LPO / quotation</h2>
          <NewLpoForm />
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              {showOwner && <th>Department</th>}
              <th>Project</th>
              {showOwner && <th>Created by</th>}
              <th>Amount</th>
              {showMargin && <th>Margin</th>}
              <th>Customer LPO</th>
              <th>Status</th>
              <th>Created</th>
              {showActions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {lpos.length === 0 ? (
              <tr>
                <td colSpan={10} className="empty-state">No LPOs yet.</td>
              </tr>
            ) : (
              lpos.map((l) => (
                <tr key={l.id}>
                  <td className="mono">{l.reference}</td>
                  {showOwner && <td>{DEPARTMENT_LABELS[l.department]}</td>}
                  <td>{l.projectName}</td>
                  {showOwner && <td>{l.createdBy.fullName}</td>}
                  <td className="mono">{formatAED(Number(l.amount))}</td>
                  {showMargin && <td className="mono">{l.margin === null ? "—" : formatAED(Number(l.margin))}</td>}
                  <td className="mono">{l.customerLpoRef || "—"}</td>
                  <td><span className={`status ${l.status}`}>{STATUS_LABELS[l.status]}</span></td>
                  <td className="mono">{l.createdAt.toLocaleDateString("en-AE")}</td>
                  {showActions && <td><LpoRowActions id={l.id} status={l.status} /></td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
