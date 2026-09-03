"use server";

import { revalidatePath } from "next/cache";
import type { Department } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { targetSchema } from "@/lib/validation";
import { PRODUCING_DEPARTMENTS } from "@/lib/format";

export interface TargetResult {
  error?: string;
  success?: boolean;
}

// Set (or update) one department's annual revenue and GP target. The
// dashboard divides these by 12 for the monthly view.
export async function saveTargetAction(
  department: Department,
  formData: FormData
): Promise<TargetResult> {
  await requireManager();
  if (!PRODUCING_DEPARTMENTS.includes(department)) {
    return { error: "Targets are only set for producing departments." };
  }

  const parsed = targetSchema.safeParse({
    year: formData.get("year"),
    revenueTarget: formData.get("revenueTarget"),
    gpTarget: formData.get("gpTarget"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { year, revenueTarget, gpTarget } = parsed.data;
  if (gpTarget > revenueTarget) {
    return { error: "The GP target cannot exceed the revenue target." };
  }

  await prisma.target.upsert({
    where: { department_year: { department, year } },
    create: { department, year, revenueTarget, gpTarget },
    update: { revenueTarget, gpTarget },
  });

  revalidatePath("/targets");
  revalidatePath("/dashboard");
  return { success: true };
}
