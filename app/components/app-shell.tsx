import Link from "next/link";
import type { User } from "@prisma/client";
import { toActor } from "@/lib/auth";
import { canCreateLpo, canInvoice, canManageAccounts, canSetTargets, canViewMonitoring, isManager } from "@/lib/permissions";
import { DEPARTMENT_LABELS } from "@/lib/format";
import { logoutAction } from "@/app/logout/actions";

export type Section = "dashboard" | "deals" | "invoices" | "targets" | "monitoring" | "users" | "security";

const ROLE_LABELS = { employee: "Employee", manager: "Manager", admin: "Admin" } as const;

export default function AppShell({
  user,
  active,
  children,
}: {
  user: User;
  active: Section;
  children: React.ReactNode;
}) {
  const actor = toActor(user);
  // Each role sees only its own tools: the BM gets the dashboard, the
  // admin gets accounts + security, employees get their queue.
  const links: Array<{ id: Section; href: string; label: string; show: boolean }> = [
    { id: "dashboard", href: "/dashboard", label: "Dashboard", show: isManager(actor) },
    { id: "deals", href: "/deals", label: canCreateLpo(actor) ? "My Enquiries" : "Enquiries", show: canCreateLpo(actor) || isManager(actor) },
    { id: "invoices", href: "/invoices", label: "Pending Invoices", show: canInvoice(actor) },
    { id: "targets", href: "/targets", label: "Targets", show: canSetTargets(actor) },
    { id: "monitoring", href: "/monitoring", label: "Monitoring", show: canViewMonitoring(actor) },
    { id: "users", href: "/admin/users", label: "Users", show: canManageAccounts(actor) },
    { id: "security", href: "/admin/security", label: "Security", show: canManageAccounts(actor) },
  ];

  return (
    <>
      <header className="app-header">
        <div className="app-header-top">
          <Link href="/" className="brand" style={{ textDecoration: "none" }}>
            <span className="brand-mark">BMTC</span>
            <span className="brand-sub">Quotation &amp; LPO Control</span>
          </Link>
          <div className="header-user">
            <span>{user.fullName}</span>
            <span className="pill brand">{ROLE_LABELS[user.role]}</span>
            {user.role === "employee" && <span className="pill">{DEPARTMENT_LABELS[user.department]}</span>}
            <form action={logoutAction}>
              <button type="submit" className="btn" style={{ padding: "6px 12px", fontSize: 12 }}>
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav className="app-nav">
          {links
            .filter((l) => l.show)
            .map((l) => (
              <Link key={l.id} href={l.href} className={`nav-link${l.id === active ? " active" : ""}`}>
                {l.label}
              </Link>
            ))}
        </nav>
      </header>
      <div className="page-wrap">{children}</div>
    </>
  );
}
