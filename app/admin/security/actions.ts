"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { verifyChain } from "@/lib/audit";

export interface SecurityActionResult {
  error?: string;
  success?: boolean;
}

// Clears a lockout / failed-attempt counter so a legitimately locked-out
// user can sign in again. Admin only.
export async function unlockAccountAction(userId: number): Promise<SecurityActionResult> {
  await requireAdmin();
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "User not found." };

  await prisma.user.update({
    where: { id: userId },
    data: { failedAttempts: 0, lockedUntil: null },
  });
  revalidatePath("/admin/security");
  return { success: true };
}

export interface ChainCheckResult {
  error?: string;
  valid?: boolean;
  total?: number;
  brokenAtId?: number | null;
  reason?: string | null;
}

// Re-derives every audit hash and reports the first mismatch. Admin only.
export async function verifyChainAction(): Promise<ChainCheckResult> {
  await requireAdmin();
  const result = await verifyChain(prisma);
  return {
    valid: result.valid,
    total: result.total,
    brokenAtId: result.brokenAtId,
    reason: result.reason,
  };
}
