import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  canCreateLpo,
  canInvoice,
  canManageAccounts,
  canViewMonitoring,
  canViewManagerDashboard,
  type Actor,
} from "@/lib/permissions";
import type { User } from "@prisma/client";

/**
 * Resolve the current user from the live database, not just the cookie.
 * A JWT stays valid until it expires, so a deactivated or deleted account
 * must be caught here — this runs on every protected page and action.
 * Returns null when there's no valid, active session.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.isActive) return null;
  return user;
}

/** Require a signed-in, active user. Redirects to /login otherwise. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require a user who has already set a real password. Use on every page
 * except the change-password flow itself, so a first-login account can't
 * navigate around the forced reset.
 */
export async function requireReadyUser(): Promise<User> {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/account/change-password");
  return user;
}

export async function requireManager(): Promise<User> {
  const user = await requireReadyUser();
  if (!canViewManagerDashboard(user)) redirect("/");
  return user;
}

export async function requireMonitor(): Promise<User> {
  const user = await requireReadyUser();
  if (!canViewMonitoring(user)) redirect("/");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireReadyUser();
  if (!canManageAccounts(user)) redirect("/");
  return user;
}

export async function requireLpoCreator(): Promise<User> {
  const user = await requireReadyUser();
  if (!canCreateLpo(user)) redirect("/");
  return user;
}

export async function requireInvoicer(): Promise<User> {
  const user = await requireReadyUser();
  if (!canInvoice(user)) redirect("/");
  return user;
}

// Narrow a full User to the Actor shape the permission helpers expect.
export function toActor(user: Pick<User, "id" | "role" | "department">): Actor {
  return { id: user.id, role: user.role, department: user.department };
}
