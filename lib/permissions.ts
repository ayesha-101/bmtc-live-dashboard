import type { Department, Prisma, UserRole } from "@prisma/client";

// The one place the access rules live. Every API route and server action
// derives its filters and its "may they see margin?" answer from here, on
// the server — never from anything the client sends.
//
//   role = manager        -> everything: all departments, all statuses,
//                            margin, and the full audit log.
//   department = sales_admin -> the cross-department Pending Invoices
//                            queue (no margin, no other data).
//   everyone else (employee) -> only the LPOs they created, no margin.

export interface Actor {
  id: number;
  role: UserRole;
  department: Department;
}

export function isManager(user: Actor): boolean {
  return user.role === "manager";
}

// A Sales Admin is an employee in the sales_admin department. Managers are
// not Sales Admins, but they can do everything a Sales Admin can and more.
export function isSalesAdmin(user: Actor): boolean {
  return user.role === "employee" && user.department === "sales_admin";
}

// Only managers ever see the internal margin figure.
export function canSeeMargin(user: Actor): boolean {
  return isManager(user);
}

// Who may create LPOs: producing-department employees. Sales Admin is a
// back-office function and doesn't originate LPOs; managers oversee.
export function canCreateLpo(user: Actor): boolean {
  return user.role === "employee" && user.department !== "sales_admin";
}

// Who may mark a pending invoice done.
export function canInvoice(user: Actor): boolean {
  return isManager(user) || isSalesAdmin(user);
}

// Who may reach the manager dashboard / overview.
export function canViewManagerDashboard(user: Actor): boolean {
  return isManager(user);
}

// The Prisma `where` that scopes a general LPO listing to what this user
// is allowed to see.
export function lpoListScope(user: Actor): Prisma.LpoWhereInput {
  if (isManager(user)) return {};
  if (isSalesAdmin(user)) return { status: "pending_invoice" };
  return { createdById: user.id };
}

// The Prisma `where` scoping the audit feed. Managers see everything;
// everyone else sees only their own department's activity.
export function auditScope(user: Actor): Prisma.AuditLogWhereInput {
  if (isManager(user)) return {};
  return { department: user.department };
}
