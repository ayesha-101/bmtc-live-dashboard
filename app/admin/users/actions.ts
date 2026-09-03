"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { hashPassword, generateTempPassword } from "@/lib/password";
import { createUserSchema } from "@/lib/validation";
import { sendCredentialsEmail, mailConfigured, appOrigin } from "@/lib/email";
import { z } from "zod";
import { Department, UserRole } from "@prisma/client";

export interface CreateUserResult {
  error?: string;
  email?: string;
  tempPassword?: string;
  // Whether the credentials reached the person by email. The password is
  // still returned so the admin can hand it over if delivery failed.
  emailed?: boolean;
  emailError?: string;
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

  // Delivery is best-effort: the account already exists, so a mail failure
  // must never look like the creation failed.
  let emailed = false;
  let emailError: string | undefined;
  if (mailConfigured()) {
    const origin = await appOrigin();
    const res = await sendCredentialsEmail({
      to: parsed.data.email,
      fullName: parsed.data.fullName,
      tempPassword,
      loginUrl: `${origin}/login`,
      isReset: false,
    });
    emailed = res.sent;
    emailError = res.error;
  }

  revalidatePath("/admin/users");
  return { email: parsed.data.email, tempPassword, emailed, emailError };
}

export interface UserActionResult {
  error?: string;
  tempPassword?: string;
  success?: boolean;
  emailed?: boolean;
  emailError?: string;
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
  let emailed = false;
  let emailError: string | undefined;
  if (mailConfigured()) {
    const origin = await appOrigin();
    const res = await sendCredentialsEmail({
      to: target.email,
      fullName: target.fullName,
      tempPassword,
      loginUrl: `${origin}/login`,
      isReset: true,
    });
    emailed = res.sent;
    emailError = res.error;
  }

  revalidatePath("/admin/users");
  return { success: true, tempPassword, emailed, emailError };
}

const updateUserSchema = z.object({
  email: z.string().trim().toLowerCase().min(3).max(160).email("Enter a valid email address"),
  fullName: z.string().trim().min(1, "Full name is required").max(120),
  role: z.nativeEnum(UserRole),
  department: z.nativeEnum(Department),
});

// Edit an existing account's email, role, and (for employees) department.
// Two guards keep the system from becoming unadministrable: an admin can't
// change their own role, and the last active admin can't be demoted.
export async function updateUserAction(
  userId: number,
  formData: FormData
): Promise<UserActionResult> {
  const admin = await requireAdmin();

  const parsed = updateUserSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
    department: formData.get("department"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Pick a valid email, role and department." };
  }
  const { email, fullName, role, department } = parsed.data;

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

  // Changing your own role could lock you out of administration entirely,
  // so it is refused — but you may still correct your own email.
  if (userId === admin.id && role !== admin.role) {
    return { error: "You can't change your own role." };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { email, fullName, role, department },
    });
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002") {
      return { error: "That email address is already registered." };
    }
    throw e;
  }
  revalidatePath("/admin/users");
  revalidatePath("/admin/security");
  return { success: true };
}

// Permanently delete an account. Only possible while it has no history:
// an account that created LPOs or wrote audit entries must be deactivated
// instead, so the audit trail can never be orphaned or rewritten.
export async function deleteUserAction(userId: number): Promise<UserActionResult> {
  const admin = await requireAdmin();
  if (userId === admin.id) {
    return { error: "You can't delete your own account." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: { select: { dealsCreated: true, dealsInvoiced: true, auditEntries: true } },
    },
  });
  if (!target) return { error: "User not found." };

  const history =
    target._count.dealsCreated + target._count.dealsInvoiced + target._count.auditEntries;
  if (history > 0) {
    return {
      error: `This account has ${history} linked record(s) and can't be deleted — deactivate it instead.`,
    };
  }

  if (target.role === "admin" && target.isActive) {
    const activeAdmins = await prisma.user.count({ where: { role: "admin", isActive: true } });
    if (activeAdmins <= 1) {
      return { error: "This is the last active admin — create another admin first." };
    }
  }

  // Clear the self-referencing createdBy pointer on anyone this account
  // created, so the delete can't fail on a foreign key.
  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({ where: { createdById: userId }, data: { createdById: null } });
    await tx.user.delete({ where: { id: userId } });
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/security");
  return { success: true };
}
