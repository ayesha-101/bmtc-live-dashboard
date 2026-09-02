import { requireInvoicer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DEPARTMENT_LABELS, formatAED } from "@/lib/format";
import AppShell from "@/app/components/app-shell";
import LivePoll from "@/app/components/live-poll";
import InvoiceRowActions from "./invoice-row-actions";

export default async function InvoicesPage() {
  const user = await requireInvoicer();

  // Note the explicit select: margin is never read into this page, so it
  // cannot reach a Sales Admin's browser even by accident.
  const [pending, recent] = await Promise.all([
    prisma.lpo.findMany({
      where: { status: "pending_invoice" },
      select: {
        id: true,
        reference: true,
        department: true,
        projectName: true,
        amount: true,
        customerLpoRef: true,
        updatedAt: true,
        createdBy: { select: { fullName: true } },
      },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.lpo.findMany({
      where: { status: "invoiced" },
      select: {
        id: true,
        reference: true,
        department: true,
        amount: true,
        invoicedAt: true,
        invoicedBy: { select: { fullName: true } },
      },
      orderBy: { invoicedAt: "desc" },
      take: 15,
    }),
  ]);

  return (
    <AppShell user={user} active="invoices">
      <LivePoll />
      <div className="row-between section-gap">
        <div>
          <h1>Pending Invoices</h1>
          <p className="muted">
            Converted LPOs from every department, waiting to be invoiced. Margin
            is never shown here. Marking one <b>Done</b> is instant — if a
            colleague completes a row first, you&apos;ll be told it was already
            handled. This list refreshes itself.
          </p>
        </div>
        <span className="muted"><span className="live-dot" />live</span>
      </div>

      <div className="table-wrap section-gap">
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Department</th>
              <th>Project</th>
              <th>Created by</th>
              <th>Customer LPO</th>
              <th>Amount</th>
              <th>Waiting since</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 ? (
              <tr><td colSpan={8} className="empty-state">Nothing waiting to be invoiced.</td></tr>
            ) : (
              pending.map((l) => (
                <tr key={l.id}>
                  <td className="mono">{l.reference}</td>
                  <td>{DEPARTMENT_LABELS[l.department]}</td>
                  <td>{l.projectName}</td>
                  <td>{l.createdBy.fullName}</td>
                  <td className="mono">{l.customerLpoRef || "—"}</td>
                  <td className="mono">{formatAED(Number(l.amount))}</td>
                  <td className="mono">{l.updatedAt.toLocaleDateString("en-AE")}</td>
                  <td><InvoiceRowActions id={l.id} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {recent.length > 0 && (
        <div className="card">
          <h2>Recently invoiced</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Department</th>
                  <th>Amount</th>
                  <th>Invoiced by</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((l) => (
                  <tr key={l.id}>
                    <td className="mono">{l.reference}</td>
                    <td>{DEPARTMENT_LABELS[l.department]}</td>
                    <td className="mono">{formatAED(Number(l.amount))}</td>
                    <td>{l.invoicedBy?.fullName ?? "—"}</td>
                    <td className="mono">{l.invoicedAt?.toLocaleString("en-AE") ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}
