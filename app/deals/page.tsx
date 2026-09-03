import { redirect } from "next/navigation";
import { requireReadyUser, toActor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canCreateLpo, canSeeMargin, dealListScope, isManager, isShowroom } from "@/lib/permissions";
import { DEPARTMENT_SHORT, STAGE_LABELS, formatAED, formatDate } from "@/lib/format";
import AppShell from "@/app/components/app-shell";
import LivePoll from "@/app/components/live-poll";
import NewDealForm from "./new-deal-form";
import NewShowroomForm from "./new-showroom-form";
import DealRowActions from "./deal-row-actions";

export default async function DealsPage() {
  const user = await requireReadyUser();
  const actor = toActor(user);
  if (!canCreateLpo(actor) && !isManager(actor)) redirect("/");

  const showGp = canSeeMargin(actor);
  const showOwner = isManager(actor);
  // Showroom rows are complete on creation, so they get no stage buttons
  // and a lean table without quotation/invoice columns.
  const showroom = isShowroom(actor);
  const showActions = canCreateLpo(actor) && !showroom;

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
          <h1>{showroom ? "Showroom Sales" : isManager(actor) ? "All Enquiries" : "My Enquiries"}</h1>
          <p className="muted">
            {showroom
              ? "Retail sales. Record the customer's LPO and the sale is complete — no quotation or invoicing step."
              : "Every enquiry from the day it arrives through quotation, LPO and invoice. Each stage keeps its own reference, value and date."}
          </p>
        </div>
        <span className="muted"><span className="live-dot" />live</span>
      </div>

      {canCreateLpo(actor) && (
        <div className="card section-gap">
          <h2>{showroom ? "New sale" : "New enquiry"}</h2>
          {showroom ? <NewShowroomForm /> : <NewDealForm />}
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{showroom ? "Date" : "Enquiry date"}</th>
              <th>Month</th>
              {showOwner && <th>Dept</th>}
              <th>Customer</th>
              <th>{showroom ? "Description" : "Project"}</th>
              <th>Sales person</th>
              {!showroom && <th>D&amp;E</th>}
              {!showroom && <th>Quote ref #</th>}
              {!showroom && <th>Quote value</th>}
              <th>LPO ref</th>
              <th>{showroom ? "Value" : "LPO value"}</th>
              {!showroom && <th>Invoice #</th>}
              {!showroom && <th>Invoice value</th>}
              {showGp && <th>GP</th>}
              <th>Stage</th>
              {showOwner && <th>Created by</th>}
              {showActions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {deals.length === 0 ? (
              <tr><td colSpan={18} className="empty-state">{showroom ? "No sales recorded yet." : "No enquiries yet."}</td></tr>
            ) : (
              deals.map((d) => {
                // The GP that matters at this stage: invoice → LPO → quote.
                const gp = d.invoiceGp ?? d.lpoGp ?? d.quoteGp;
                return (
                  <tr key={d.id}>
                    <td className="mono">{formatDate(d.enquiryDate)}</td>
                    <td>{d.enquiryDate.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}</td>
                    {showOwner && <td>{DEPARTMENT_SHORT[d.department]}</td>}
                    <td>{d.customer}</td>
                    <td>{d.projectName}</td>
                    <td>{d.salesPerson || "—"}</td>
                    {!showroom && <td>{d.deResponsible || "—"}</td>}
                    {!showroom && <td className="mono">{d.quoteRef || "—"}</td>}
                    {!showroom && <td className="mono">{d.quoteValue === null ? "—" : formatAED(Number(d.quoteValue))}</td>}
                    <td className="mono">{d.lpoRef || "—"}</td>
                    <td className="mono">{d.lpoValue === null ? "—" : formatAED(Number(d.lpoValue))}</td>
                    {!showroom && <td className="mono">{d.invoiceRef || "—"}</td>}
                    {!showroom && <td className="mono">{d.invoiceValue === null ? "—" : formatAED(Number(d.invoiceValue))}</td>}
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
