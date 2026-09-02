"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireReadyUser, toActor } from "@/lib/auth";
import { canCreateLpo } from "@/lib/permissions";
import { createLpoSchema } from "@/lib/validation";
import { nextReference } from "@/lib/reference";
import { writeAudit } from "@/lib/audit";

export interface CreateLpoResult {
  error?: string;
  success?: boolean;
}

export async function createLpoAction(
  _prev: CreateLpoResult,
  formData: FormData
): Promise<CreateLpoResult> {
  const user = await requireReadyUser();
  // Server-side authorization — never trust the client to have hidden the
  // form.
  if (!canCreateLpo(toActor(user))) {
    return { error: "You are not allowed to create LPOs." };
  }

  const parsed = createLpoSchema.safeParse({
    projectName: formData.get("projectName"),
    amount: formData.get("amount"),
    margin: formData.get("margin") || undefined,
    customerLpoRef: formData.get("customerLpoRef"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { projectName, amount, margin, customerLpoRef, status } = parsed.data;

  await prisma.$transaction(async (tx) => {
    const reference = await nextReference(tx);
    const lpo = await tx.lpo.create({
      data: {
        reference,
        department: user.department,
        createdById: user.id,
        projectName,
        amount,
        margin: margin ?? null,
        status,
        customerLpoRef: customerLpoRef || null,
      },
    });
    await writeAudit(tx, {
      lpoId: lpo.id,
      actorId: user.id,
      department: user.department,
      action: status === "converted_lpo" ? "converted_to_lpo" : "quotation_created",
      note: `${reference} · ${projectName}`,
    });
  });

  revalidatePath("/lpos");
  revalidatePath("/dashboard");
  return { success: true };
}

export interface TransitionResult {
  error?: string;
  success?: boolean;
}

// Move one of the caller's own LPOs from an expected status to a new one,
// atomically. The updateMany WHERE clause pins id + owner + current status
// in a single write, so it can't be used to touch someone else's record,
// skip a step, or double-apply on a concurrent click (count 0 => refused).
async function ownerTransition(
  lpoId: number,
  from: "quoted" | "converted_lpo",
  to: "converted_lpo" | "pending_invoice" | "lost",
  action: string
): Promise<TransitionResult> {
  const user = await requireReadyUser();
  if (!canCreateLpo(toActor(user))) {
    return { error: "You are not allowed to change LPOs." };
  }

  const done = await prisma.$transaction(async (tx) => {
    const res = await tx.lpo.updateMany({
      where: { id: lpoId, createdById: user.id, status: from },
      data: { status: to },
    });
    if (res.count === 0) return false;
    await writeAudit(tx, {
      lpoId,
      actorId: user.id,
      department: user.department,
      action,
    });
    return true;
  });

  if (!done) return { error: "That LPO can't change from its current status." };

  revalidatePath("/lpos");
  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  return { success: true };
}

export async function convertToLpoAction(lpoId: number): Promise<TransitionResult> {
  return ownerTransition(lpoId, "quoted", "converted_lpo", "converted_to_lpo");
}

export async function sendToInvoicingAction(lpoId: number): Promise<TransitionResult> {
  return ownerTransition(lpoId, "converted_lpo", "pending_invoice", "sent_to_invoicing");
}

// Lost can be flagged from either open stage.
export async function markLostAction(lpoId: number): Promise<TransitionResult> {
  const fromQuoted = await ownerTransition(lpoId, "quoted", "lost", "flagged_lost");
  if (fromQuoted.success || fromQuoted.error !== "That LPO can't change from its current status.") {
    return fromQuoted;
  }
  return ownerTransition(lpoId, "converted_lpo", "lost", "flagged_lost");
}
