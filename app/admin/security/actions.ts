"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

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
