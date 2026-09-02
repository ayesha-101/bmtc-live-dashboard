"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireReadyUser, toActor } from "@/lib/auth";
import { canInvoice } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

export interface InvoiceResult {
  error?: string;
  success?: boolean;
}

// Marks a pending invoice done. The write is a single status-guarded
// updateMany (WHERE status = 'pending_invoice') exactly as the plan
// specifies: if two Sales Admins click "Done" on the same row at once,
// Postgres applies one and the other matches zero rows — so the loser is
// told it was already handled instead of both silently succeeding.
export async function markInvoicedAction(lpoId: number): Promise<InvoiceResult> {
  const user = await requireReadyUser();
  if (!canInvoice(toActor(user))) {
    return { error: "You are not allowed to invoice." };
  }

  const done = await prisma.$transaction(async (tx) => {
    const res = await tx.lpo.updateMany({
      where: { id: lpoId, status: "pending_invoice" },
      data: { status: "invoiced", invoicedById: user.id, invoicedAt: new Date() },
    });
    if (res.count === 0) return false;
    // The audit entry records the LPO's own department, not the actor's
    // (Sales Admin is cross-department), so the log reads correctly.
    const lpo = await tx.lpo.findUnique({ where: { id: lpoId }, select: { department: true } });
    await writeAudit(tx, {
      lpoId,
      actorId: user.id,
      department: lpo!.department,
      action: "invoiced",
      note: `Invoiced by ${user.fullName}`,
    });
    return true;
  });

  if (!done) {
    return { error: "Already completed by another employee." };
  }

  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { success: true };
}
