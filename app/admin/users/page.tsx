import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DEPARTMENT_LABELS } from "@/lib/format";
import AppShell from "@/app/components/app-shell";
import CreateUserForm from "./create-user-form";
import UserRowActions from "./user-row-actions";

export default async function UsersPage() {
  const manager = await requireManager();

  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
  });

  return (
    <AppShell user={manager} active="users">
      <div className="section-gap">
        <h1>Users</h1>
        <p className="muted">
          Manager-only. Create accounts, deactivate them (access is revoked on
          their next request), and reset passwords. There is no public sign-up.
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
              <th>Username</th>
              <th>Department</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.fullName}</td>
                <td className="mono">{u.username}</td>
                <td>{DEPARTMENT_LABELS[u.department]}</td>
                <td>{u.role === "manager" ? "Manager" : "Employee"}</td>
                <td>
                  <span className={`status ${u.isActive ? "converted_lpo" : "lost"}`}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <UserRowActions userId={u.id} isActive={u.isActive} isSelf={u.id === manager.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
