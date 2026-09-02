import type { Department, Prisma, UserRole } from "@prisma/client";

// The one place the access rules live. Every API route and server action
// derives its filters and its "may they see margin?" answer from here, on
// the server — never from anything the client sends.
//
//   role = manager (the BM)  -> READ-ONLY dashboard + activity across all
//                               departments, including margin. Nothing else:
//                               no LPO edits, no invoicing, no accounts.
//   role = admin             -> accounts + security only. Never sees the
//                               dashboard, LPOs, margin, or invoices.
//   department = sales_admin -> the cross-department Pending Invoices
//                               queue (no margin, no other data).
//   everyone else (employee) -> only the LPOs they created, no margin.

export interface Actor {
  id: number;
  role: UserRole;
  department: Department;
}

export function isManager(user: Actor): boolean {
  return user.role === "manager";
}

export function isAdmin(user: Actor): boolean {
  return user.role === "admin";
}

// A Sales Admin is an employee in the sales_admin department.
export function isSalesAdmin(user: Actor): boolean {
  return user.role === "employee" && user.department === "sales_admin";
}

// Only the BM ever sees the internal margin figure.
export function canSeeMargin(user: Actor): boolean {
  return isManager(user);
}

// Who may create and drive LPOs: producing-department employees only.
export function canCreateLpo(user: Actor): boolean {
  return user.role === "employee" && user.department !== "sales_admin";
}

// Who may mark a pending invoice done: Sales Admin only.
export function canInvoice(user: Actor): boolean {
  return isSalesAdmin(user);
}

// Who may reach the manager dashboard / overview: the BM only.
export function canViewManagerDashboard(user: Actor): boolean {
  return isManager(user);
}

// Who may read the monitoring trail: the BM (oversight of what the team
// did) and the admin (security accountability). It shows WHO did WHAT and
// WHEN — never amounts or margin — so it does not leak business figures to
// the admin.
export function canViewMonitoring(user: Actor): boolean {
  return isManager(user) || isAdmin(user);
}

// Who may create accounts, deactivate them, reset passwords, and monitor
// account security: the admin only.
export function canManageAccounts(user: Actor): boolean {
  return isAdmin(user);
}

// The Prisma `where` that scopes a general LPO listing to what this user
// is allowed to see.
export function lpoListScope(user: Actor): Prisma.LpoWhereInput {
  if (isManager(user)) return {};
  if (isSalesAdmin(user)) return { status: "pending_invoice" };
  return { createdById: user.id };
}
