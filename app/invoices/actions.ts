"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireReadyUser, toActor } from "@/lib/auth";
import { canInvoice } from "@/lib/permissions";
import { invoiceSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export interface InvoiceResult {
  error?: string;
  success?: boolean;
}

// Bills a pending job. The write is a single stage-guarded updateMany, so
// if two Sales Admins submit the same row at once Postgres applies one and
// the other matches zero rows — the loser is told it was already handled
// instead of both silently succeeding.
export async function markInvoicedAction(
  dealId: number,
  formData: FormData
): Promise<InvoiceResult> {
  const user = await requireReadyUser();
  if (!canInvoice(toActor(user))) {
    return { error: "You are not allowed to invoice." };
  }

  const parsed = invoiceSchema.safeParse({
    invoiceRef: formData.get("invoiceRef"),
    invoiceValue: formData.get("invoiceValue"),
    invoiceGp: formData.get("invoiceGp") || undefined,
    invoiceDate: formData.get("invoiceDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const inv = parsed.data;

  const done = await prisma.$transaction(async (tx) => {
    const res = await tx.deal.updateMany({
      where: { id: dealId, stage: "pending_invoice" },
      data: {
        invoiceRef: inv.invoiceRef,
        invoiceValue: inv.invoiceValue,
        invoiceGp: inv.invoiceGp ?? null,
        invoiceDate: inv.invoiceDate,
        invoicedById: user.id,
        stage: "invoiced",
      },
    });
    if (res.count === 0) return false;
    // The audit entry records the DEAL's department, not the actor's,
    // since Sales Admin works across all of them.
    const deal = await tx.deal.findUnique({ where: { id: dealId }, select: { department: true } });
    await writeAudit(tx, {
      dealId,
      actorId: user.id,
      department: deal!.department,
      action: "invoiced",
      note: `Invoice ${inv.invoiceRef}`,
    });
    return true;
  });

  if (!done) return { error: "Already completed by another employee." };

  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/deals");
  revalidatePath("/monitoring");
  return { success: true };
}
