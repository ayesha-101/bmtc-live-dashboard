"use client";

import { useState, useTransition } from "react";
import type { Department, UserRole } from "@prisma/client";
import { toggleActiveAction, resetPasswordAction, changeRoleAction } from "./actions";
import { DEPARTMENT_LABELS } from "@/lib/format";

const DEPARTMENTS: Department[] = ["electrical", "urban", "lightning", "water", "sales_admin"];

export default function UserRowActions({
  userId,
  isActive,
  isSelf,
  role,
  department,
}: {
  userId: number;
  isActive: boolean;
  isSelf: boolean;
  role: UserRole;
  department: Department;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [temp, setTemp] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftRole, setDraftRole] = useState<UserRole>(role);

  if (isSelf) return <span className="muted">— you —</span>;

  function toggle() {
    setError(null);
    setTemp(null);
    startTransition(async () => {
      const res = await toggleActiveAction(userId);
      if (res.error) setError(res.error);
    });
  }

  function reset() {
    if (!confirm("Reset this user's password? Their current password stops working immediately.")) return;
    setError(null);
    setTemp(null);
    startTransition(async () => {
      const res = await resetPasswordAction(userId);
      if (res.error) setError(res.error);
      else if (res.tempPassword) setTemp(res.tempPassword);
    });
  }

  function saveRole(formData: FormData) {
    setError(null);
    setTemp(null);
    startTransition(async () => {
      const res = await changeRoleAction(userId, formData);
      if (res.error) setError(res.error);
      else setEditing(false);
    });
  }

  if (editing) {
    return (
      <form action={saveRole} style={{ minWidth: 260 }}>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>Role</label>
          <select
            name="role"
            value={draftRole}
            onChange={(e) => setDraftRole(e.target.value as UserRole)}
          >
            <option value="employee">Employee</option>
            <option value="manager">Manager (BM) — dashboard only</option>
            <option value="admin">Admin — accounts &amp; security</option>
          </select>
        </div>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>
            Department{" "}
            {draftRole !== "employee" && <span className="muted">(unused for this role)</span>}
          </label>
          <select name="department" defaultValue={department}>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
            ))}
          </select>
        </div>
        {draftRole === "employee" && (
          <p className="muted" style={{ marginTop: 0, marginBottom: 8 }}>
            Pick <b>Sales Admin</b> as the department to give this person the
            Pending Invoices queue.
          </p>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" className="btn" disabled={pending} onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
        {error && <div className="note error" style={{ marginTop: 8, marginBottom: 0 }}>{error}</div>}
      </form>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <button className="btn" disabled={pending} onClick={() => { setDraftRole(role); setEditing(true); }}>
        Edit role
      </button>
      <button className="btn" disabled={pending} onClick={toggle}>
        {isActive ? "Deactivate" : "Reactivate"}
      </button>
      <button className="btn" disabled={pending} onClick={reset}>
        Reset password
      </button>
      {temp && (
        <div className="note success" style={{ width: "100%", margin: 0 }}>
          New one-time password: <b className="mono">{temp}</b>
        </div>
      )}
      {error && <div className="note error" style={{ width: "100%", margin: 0 }}>{error}</div>}
    </div>
  );
}
