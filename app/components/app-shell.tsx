import Link from "next/link";
import type { User } from "@prisma/client";
import { toActor } from "@/lib/auth";
import { canCreateLpo, canInvoice, isManager } from "@/lib/permissions";
import { DEPARTMENT_LABELS } from "@/lib/format";
import { logoutAction } from "@/app/logout/actions";

export type Section = "dashboard" | "lpos" | "invoices" | "users";

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
  const links: Array<{ id: Section; href: string; label: string; show: boolean }> = [
    { id: "dashboard", href: "/dashboard", label: "Dashboard", show: isManager(actor) },
    { id: "lpos", href: "/lpos", label: "My LPOs", show: canCreateLpo(actor) || isManager(actor) },
    { id: "invoices", href: "/invoices", label: "Pending Invoices", show: canInvoice(actor) },
    { id: "users", href: "/admin/users", label: "Users", show: isManager(actor) },
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
            <span className="pill brand">{user.role === "manager" ? "Manager" : "Employee"}</span>
            <span className="pill">{DEPARTMENT_LABELS[user.department]}</span>
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
