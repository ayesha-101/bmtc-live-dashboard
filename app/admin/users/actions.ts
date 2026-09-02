"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { hashPassword, generateTempPassword } from "@/lib/password";
import { createUserSchema } from "@/lib/validation";
import { z } from "zod";
import { Department, UserRole } from "@prisma/client";

export interface CreateUserResult {
  error?: string;
  email?: string;
  tempPassword?: string;
}

export async function createUserAction(
  _prev: CreateUserResult,
  formData: FormData
): Promise<CreateUserResult> {
  const manager = await requireAdmin();

  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    department: formData.get("department"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  try {
    await prisma.user.create({
      data: {
        email: parsed.data.email,
        fullName: parsed.data.fullName,
        department: parsed.data.department,
        role: parsed.data.role,
        passwordHash,
        mustChangePassword: true,
        createdById: manager.id,
      },
    });
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002") {
      return { error: "That email address is already registered." };
    }
    throw e;
  }

  revalidatePath("/admin/users");
  return { email: parsed.data.email, tempPassword };
}

export interface UserActionResult {
  error?: string;
  tempPassword?: string;
  success?: boolean;
}

export async function toggleActiveAction(userId: number): Promise<UserActionResult> {
  const manager = await requireAdmin();
  if (userId === manager.id) {
    return { error: "You can't deactivate your own account." };
  }
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "User not found." };

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: !target.isActive },
  });
  revalidatePath("/admin/users");
  return { success: true };
}

export async function resetPasswordAction(userId: number): Promise<UserActionResult> {
  const manager = await requireAdmin();
  if (userId === manager.id) {
    return { error: "Use the Change password page for your own account." };
  }
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "User not found." };

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      mustChangePassword: true,
      failedAttempts: 0,
      lockedUntil: null,
    },
  });
  revalidatePath("/admin/users");
  return { success: true, tempPassword };
}

const changeRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
  department: z.nativeEnum(Department),
});

// Change an existing account's role (and, for employees, department).
// Two guards keep the system from becoming unadministrable: an admin can't
// change their own role, and the last active admin can't be demoted.
export async function changeRoleAction(
  userId: number,
  formData: FormData
): Promise<UserActionResult> {
  const admin = await requireAdmin();
  if (userId === admin.id) {
    return { error: "You can't change your own role." };
  }

  const parsed = changeRoleSchema.safeParse({
    role: formData.get("role"),
    department: formData.get("department"),
  });
  if (!parsed.success) return { error: "Pick a valid role and department." };
  const { role, department } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "User not found." };

  if (target.role === "admin" && role !== "admin") {
    const activeAdmins = await prisma.user.count({
      where: { role: "admin", isActive: true },
    });
    if (activeAdmins <= 1) {
      return { error: "This is the last active admin — promote someone else first." };
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role, department },
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/security");
  return { success: true };
}
