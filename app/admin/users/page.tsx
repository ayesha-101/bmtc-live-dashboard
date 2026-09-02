import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DEPARTMENT_LABELS } from "@/lib/format";
import AppShell from "@/app/components/app-shell";
import CreateUserForm from "./create-user-form";
import UserRowActions from "./user-row-actions";

const ROLE_LABELS = { employee: "Employee", manager: "Manager", admin: "Admin" } as const;

export default async function UsersPage() {
  const admin = await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
  });

  return (
    <AppShell user={admin} active="users">
      <div className="section-gap">
        <h1>Users</h1>
        <p className="muted">
          Admin-only. Create accounts (employees, the manager, other admins),
          deactivate them — access is revoked on their next request — and
          reset passwords. There is no public sign-up.
        </p>
      </div>

      <div className="card section-gap">
        <h2>New account</h2>
        <CreateUserForm />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.fullName}</td>
                <td className="mono">{u.email}</td>
                <td>{ROLE_LABELS[u.role]}</td>
                <td>{u.role === "employee" ? DEPARTMENT_LABELS[u.department] : "—"}</td>
                <td>
                  <span className={`status ${u.isActive ? "converted_lpo" : "lost"}`}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <UserRowActions
                    userId={u.id}
                    isActive={u.isActive}
                    isSelf={u.id === admin.id}
                    role={u.role}
                    department={u.department}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
