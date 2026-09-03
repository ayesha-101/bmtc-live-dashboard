"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireReadyUser, toActor } from "@/lib/auth";
import { canCreateLpo } from "@/lib/permissions";
import { createDealSchema, quoteSchema, lpoSchema } from "@/lib/validation";
import { nextReference } from "@/lib/reference";
import { writeAudit } from "@/lib/audit";

export interface DealResult {
  error?: string;
  success?: boolean;
}

function revalidateAll() {
  revalidatePath("/deals");
  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  revalidatePath("/monitoring");
}

/** Log a new enquiry, optionally quoting it in the same step. */
export async function createDealAction(
  _prev: DealResult,
  formData: FormData
): Promise<DealResult> {
  const user = await requireReadyUser();
  if (!canCreateLpo(toActor(user))) {
    return { error: "You are not allowed to create enquiries." };
  }

  const raw = {
    enquiryDate: formData.get("enquiryDate"),
    customer: formData.get("customer"),
    projectName: formData.get("projectName"),
    salesPerson: formData.get("salesPerson"),
    deResponsible: formData.get("deResponsible"),
    quoteRef: formData.get("quoteRef"),
    quoteValue: formData.get("quoteValue") || undefined,
    quoteGp: formData.get("quoteGp") || undefined,
    quoteDate: formData.get("quoteDate") || undefined,
  };
  const parsed = createDealSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  // A quotation counts as issued only when it has both a reference and a
  // value; otherwise the row stays at the enquiry stage.
  const quoted = !!(d.quoteRef && d.quoteValue !== undefined);

  await prisma.$transaction(async (tx) => {
    const reference = await nextReference(tx);
    const deal = await tx.deal.create({
      data: {
        reference,
        department: user.department,
        createdById: user.id,
        enquiryDate: d.enquiryDate,
        customer: d.customer,
        projectName: d.projectName,
        salesPerson: d.salesPerson || "",
        deResponsible: d.deResponsible || "",
        quoteRef: d.quoteRef || null,
        quoteValue: d.quoteValue ?? null,
        quoteGp: d.quoteGp ?? null,
        quoteDate: quoted ? (d.quoteDate ?? new Date()) : null,
        stage: quoted ? "quoted" : "enquiry",
      },
    });
    await writeAudit(tx, {
      dealId: deal.id,
      actorId: user.id,
      department: user.department,
      action: quoted ? "quotation_issued" : "enquiry_logged",
      note: `${d.customer} — ${d.projectName}`,
    });
  });

  revalidateAll();
  return { success: true };
}

/** Attach the quotation to an enquiry that was logged without one. */
export async function quoteDealAction(dealId: number, formData: FormData): Promise<DealResult> {
  const user = await requireReadyUser();
  if (!canCreateLpo(toActor(user))) return { error: "Not allowed." };

  const parsed = quoteSchema.safeParse({
    quoteRef: formData.get("quoteRef"),
    quoteValue: formData.get("quoteValue"),
    quoteGp: formData.get("quoteGp") || undefined,
    quoteDate: formData.get("quoteDate"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const q = parsed.data;

  const done = await prisma.$transaction(async (tx) => {
    // Ownership AND stage are pinned in the WHERE, so this can't touch
    // someone else's record or skip a stage.
    const res = await tx.deal.updateMany({
      where: { id: dealId, createdById: user.id, stage: "enquiry" },
      data: {
        quoteRef: q.quoteRef,
        quoteValue: q.quoteValue,
        quoteGp: q.quoteGp ?? null,
        quoteDate: q.quoteDate,
        stage: "quoted",
      },
    });
    if (res.count === 0) return false;
    await writeAudit(tx, {
      dealId,
      actorId: user.id,
      department: user.department,
      action: "quotation_issued",
      note: `Quote ${q.quoteRef}`,
    });
    return true;
  });

  if (!done) return { error: "This enquiry can't be quoted from its current stage." };
  revalidateAll();
  return { success: true };
}

/** Record the customer's LPO — the job is won and booked. */
export async function recordLpoAction(dealId: number, formData: FormData): Promise<DealResult> {
  const user = await requireReadyUser();
  if (!canCreateLpo(toActor(user))) return { error: "Not allowed." };

  const parsed = lpoSchema.safeParse({
    lpoRef: formData.get("lpoRef"),
    lpoValue: formData.get("lpoValue"),
    lpoGp: formData.get("lpoGp") || undefined,
    lpoDate: formData.get("lpoDate"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const l = parsed.data;

  const done = await prisma.$transaction(async (tx) => {
    const res = await tx.deal.updateMany({
      where: { id: dealId, createdById: user.id, stage: "quoted" },
      data: {
        lpoRef: l.lpoRef,
        lpoValue: l.lpoValue,
        lpoGp: l.lpoGp ?? null,
        lpoDate: l.lpoDate,
        stage: "lpo_received",
      },
    });
    if (res.count === 0) return false;
    await writeAudit(tx, {
      dealId,
      actorId: user.id,
      department: user.department,
      action: "lpo_received",
      note: `LPO ${l.lpoRef}`,
    });
    return true;
  });

  if (!done) return { error: "An LPO can only be recorded against a quoted enquiry." };
  revalidateAll();
  return { success: true };
}

/** Hand a won job to Sales Admin for billing. */
export async function sendToInvoicingAction(dealId: number): Promise<DealResult> {
  const user = await requireReadyUser();
  if (!canCreateLpo(toActor(user))) return { error: "Not allowed." };

  const done = await prisma.$transaction(async (tx) => {
    const res = await tx.deal.updateMany({
      where: { id: dealId, createdById: user.id, stage: "lpo_received" },
      data: { stage: "pending_invoice" },
    });
    if (res.count === 0) return false;
    await writeAudit(tx, {
      dealId,
      actorId: user.id,
      department: user.department,
      action: "sent_to_invoicing",
    });
    return true;
  });

  if (!done) return { error: "Only a job with an LPO can be sent to invoicing." };
  revalidateAll();
  return { success: true };
}

/** Mark an open enquiry or quotation as lost. */
export async function markLostAction(dealId: number, reason: string): Promise<DealResult> {
  const user = await requireReadyUser();
  if (!canCreateLpo(toActor(user))) return { error: "Not allowed." };
  const trimmed = reason.trim();
  if (!trimmed) return { error: "Give a reason so the loss can be analysed later." };

  const done = await prisma.$transaction(async (tx) => {
    const res = await tx.deal.updateMany({
      where: { id: dealId, createdById: user.id, stage: { in: ["enquiry", "quoted"] } },
      data: { stage: "lost", lostReason: trimmed },
    });
    if (res.count === 0) return false;
    await writeAudit(tx, {
      dealId,
      actorId: user.id,
      department: user.department,
      action: "flagged_lost",
      note: trimmed,
    });
    return true;
  });

  if (!done) return { error: "This job can't be marked lost from its current stage." };
  revalidateAll();
  return { success: true };
}
