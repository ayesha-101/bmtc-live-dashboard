import { redirect } from "next/navigation";
import { requireReadyUser, toActor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canCreateLpo, canSeeMargin, dealListScope, isManager } from "@/lib/permissions";
import { DEPARTMENT_LABELS, STAGE_LABELS, formatAED, formatDate } from "@/lib/format";
import AppShell from "@/app/components/app-shell";
import LivePoll from "@/app/components/live-poll";
import NewDealForm from "./new-deal-form";
import DealRowActions from "./deal-row-actions";

export default async function DealsPage() {
  const user = await requireReadyUser();
  const actor = toActor(user);
  if (!canCreateLpo(actor) && !isManager(actor)) redirect("/");

  const showGp = canSeeMargin(actor);
  const showOwner = isManager(actor);
  const showActions = canCreateLpo(actor);

  const deals = await prisma.deal.findMany({
    where: dealListScope(actor),
    include: { createdBy: { select: { fullName: true } } },
    orderBy: { enquiryDate: "desc" },
    take: 300,
  });

  return (
    <AppShell user={user} active="deals">
      <LivePoll />
      <div className="row-between section-gap">
        <div>
          <h1>{isManager(actor) ? "All Enquiries" : "My Enquiries"}</h1>
          <p className="muted">
            Every enquiry from the day it arrives through quotation, LPO and
            invoice. Each stage keeps its own reference, value and date.
          </p>
        </div>
        <span className="muted"><span className="live-dot" />live</span>
      </div>

      {canCreateLpo(actor) && (
        <div className="card section-gap">
          <h2>New enquiry</h2>
          <NewDealForm />
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Enquiry date</th>
              <th>Month</th>
              {showOwner && <th>Dept</th>}
              <th>Customer</th>
              <th>Project</th>
              <th>Sales person</th>
              <th>D&amp;E</th>
              <th>Quote ref #</th>
              <th>Quote value</th>
              <th>LPO ref</th>
              <th>LPO value</th>
              <th>Invoice #</th>
              <th>Invoice value</th>
              {showGp && <th>GP</th>}
              <th>Stage</th>
              {showOwner && <th>Created by</th>}
              {showActions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {deals.length === 0 ? (
              <tr><td colSpan={18} className="empty-state">No enquiries yet.</td></tr>
            ) : (
              deals.map((d) => {
                // The GP that matters at this stage: invoice → LPO → quote.
                const gp = d.invoiceGp ?? d.lpoGp ?? d.quoteGp;
                return (
                  <tr key={d.id}>
                    <td className="mono">{formatDate(d.enquiryDate)}</td>
                    <td>{d.enquiryDate.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}</td>
                    {showOwner && <td>{DEPARTMENT_LABELS[d.department]}</td>}
                    <td>{d.customer}</td>
                    <td>{d.projectName}</td>
                    <td>{d.salesPerson || "—"}</td>
                    <td>{d.deResponsible || "—"}</td>
                    <td className="mono">{d.quoteRef || "—"}</td>
                    <td className="mono">{d.quoteValue === null ? "—" : formatAED(Number(d.quoteValue))}</td>
                    <td className="mono">{d.lpoRef || "—"}</td>
                    <td className="mono">{d.lpoValue === null ? "—" : formatAED(Number(d.lpoValue))}</td>
                    <td className="mono">{d.invoiceRef || "—"}</td>
                    <td className="mono">{d.invoiceValue === null ? "—" : formatAED(Number(d.invoiceValue))}</td>
                    {showGp && <td className="mono">{gp === null || gp === undefined ? "—" : formatAED(Number(gp))}</td>}
                    <td>
                      <span className={`status ${d.stage}`}>{STAGE_LABELS[d.stage]}</span>
                      {d.stage === "lost" && d.lostReason && (
                        <div className="muted" style={{ fontSize: 10.5, maxWidth: 180 }}>{d.lostReason}</div>
                      )}
                    </td>
                    {showOwner && <td>{d.createdBy.fullName}</td>}
                    {showActions && <td><DealRowActions id={d.id} stage={d.stage} /></td>}
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
