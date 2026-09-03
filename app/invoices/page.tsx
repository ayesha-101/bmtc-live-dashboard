import { requireInvoicer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DEPARTMENT_SHORT, formatAED, formatDate } from "@/lib/format";
import AppShell from "@/app/components/app-shell";
import LivePoll from "@/app/components/live-poll";
import InvoiceRowActions from "./invoice-row-actions";

export default async function InvoicesPage() {
  const user = await requireInvoicer();

  // Note the explicit select: GP is never read into this page, so it can't
  // reach a Sales Admin's browser. The LPO value is pre-filled into the
  // invoice form as a convenience but stays editable.
  const [pending, recent] = await Promise.all([
    prisma.deal.findMany({
      where: { stage: "pending_invoice" },
      select: {
        id: true, reference: true, department: true, customer: true,
        projectName: true, lpoRef: true, lpoValue: true, lpoDate: true,
        createdBy: { select: { fullName: true } },
      },
      orderBy: { lpoDate: "asc" },
    }),
    prisma.deal.findMany({
      where: { stage: "invoiced" },
      select: {
        id: true, reference: true, department: true, customer: true,
        invoiceRef: true, invoiceValue: true, invoiceDate: true,
        invoicedBy: { select: { fullName: true } },
      },
      orderBy: { invoiceDate: "desc" },
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
            Awarded jobs from every department waiting to be billed. Enter the
            real invoice number, value and date — revenue is recognised from
            these figures. GP is never shown here.
          </p>
        </div>
        <span className="muted"><span className="live-dot" />live</span>
      </div>

      <div className="table-wrap section-gap">
        <table>
          <thead>
            <tr>
              <th>Ref</th><th>Department</th><th>Customer</th><th>Project</th>
              <th>LPO ref</th><th>LPO value</th><th>LPO date</th><th></th>
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 ? (
              <tr><td colSpan={8} className="empty-state">Nothing waiting to be invoiced.</td></tr>
            ) : (
              pending.map((d) => (
                <tr key={d.id}>
                  <td className="mono">{d.reference}</td>
                  <td>{DEPARTMENT_SHORT[d.department]}</td>
                  <td>{d.customer}</td>
                  <td>{d.projectName}</td>
                  <td className="mono">{d.lpoRef || "—"}</td>
                  <td className="mono">{d.lpoValue === null ? "—" : formatAED(Number(d.lpoValue))}</td>
                  <td className="mono">{formatDate(d.lpoDate)}</td>
                  <td>
                    <InvoiceRowActions
                      dealId={d.id}
                      suggestedValue={d.lpoValue === null ? null : Number(d.lpoValue)}
                      suggestedGp={null}
                    />
                  </td>
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
                  <th>Ref</th><th>Department</th><th>Customer</th>
                  <th>Invoice #</th><th>Value</th><th>Date</th><th>By</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((d) => (
                  <tr key={d.id}>
                    <td className="mono">{d.reference}</td>
                    <td>{DEPARTMENT_SHORT[d.department]}</td>
                    <td>{d.customer}</td>
                    <td className="mono">{d.invoiceRef}</td>
                    <td className="mono">{d.invoiceValue === null ? "—" : formatAED(Number(d.invoiceValue))}</td>
                    <td className="mono">{formatDate(d.invoiceDate)}</td>
                    <td>{d.invoicedBy?.fullName ?? "—"}</td>
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
